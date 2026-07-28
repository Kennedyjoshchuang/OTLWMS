import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundFloat } from "@/lib/utils";
import { PDFParse } from "pdf-parse";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import { createWorker } from "tesseract.js";

export async function POST(req: NextRequest) {
  try {
    // Set worker Src dynamically on every request to ensure it overrides any cached/incorrect global state
    if (typeof window === "undefined") {
      try {
        let workerPath = "";
        const nestedPath = path.join(process.cwd(), "node_modules", "pdf-parse", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
        const rootPath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");

        if (fs.existsSync(nestedPath)) {
          workerPath = nestedPath;
        } else if (fs.existsSync(rootPath)) {
          workerPath = rootPath;
        } else {
          // Fallback to dynamic module resolution paths
          const pdfParseEntry = require.resolve("pdf-parse");
          workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs", {
            paths: [path.dirname(pdfParseEntry), pdfParseEntry]
          });
        }

        const workerUrl = pathToFileURL(workerPath).toString();
        PDFParse.setWorker(workerUrl);
      } catch (e) {
        console.error("Failed to resolve pdf.worker.mjs inside POST:", e);
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (file.name || "").toLowerCase();
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(fileName);

    let text: string = "";

    const getOcrWorker = async () => {
      const workerPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
      return await createWorker("eng", 1, {
        workerPath: fs.existsSync(workerPath) ? workerPath : undefined,
      });
    };

    if (isImage) {
      // Use Tesseract OCR for image files
      try {
        const worker = await getOcrWorker();
        const ret = await worker.recognize(buffer);
        text = ret.data.text || "";
        await worker.terminate();
      } catch (ocrErr) {
        console.error("Tesseract OCR error for image:", ocrErr);
      }
    } else {
      // Parse PDF text using PDFParse class
      try {
        const parser = new PDFParse({ data: buffer });
        const parsedPdf = await parser.getText();
        text = parsedPdf.text || "";
      } catch (pdfErr) {
        console.error("PDFParse error:", pdfErr);
      }

      // If PDF text extraction yielded insufficient text (scanned image PDF), fallback to Tesseract OCR
      if (!text || text.trim().length < 20) {
        try {
          const worker = await getOcrWorker();
          const ret = await worker.recognize(buffer);
          text = ret.data.text || "";
          await worker.terminate();
        } catch (ocrErr) {
          console.error("Tesseract OCR fallback error for PDF:", ocrErr);
        }
      }
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // Fetch all active product codes to check tokens against
    const dbProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { productCode: true }
    });
    const knownCodes = new Set(dbProducts.map(p => p.productCode));

    let dtNumber = "";
    let orderNumber = "";
    let customerPoNo = "";
    let deliverToName = "";
    let deliverToAddress = "";
    let deliveryDate = "";
    let createdDate = "";
    
    let deliverToIndex = -1;
    let addressLineStart = -1;

    // Extract fields line-by-line using regular expressions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // DT / Pick List Number
      if (/^\d{8}$/.test(line) && !dtNumber) {
        dtNumber = line;
      }
      const dtMatch = line.match(/(?:Pick\s*List|Picking\s*List)(?:\s*No\.?)?\s*[:\.-]?\s*([A-Z0-9-]+)/i);
      if (dtMatch && !dtNumber) {
        const val = dtMatch[1].trim();
        if (!/printed|created|order|customer/i.test(val)) {
          dtNumber = val;
        }
      }

      // Order Number
      const orderMatch = line.match(/Order(?:\s*Number|\s*No\.?)?\s*[:\.-]?\s*([A-Z0-9-]+)/i);
      if (orderMatch && !orderNumber) {
        orderNumber = orderMatch[1].trim();
      }

      // Customer / PO Number (e.g. Customer: 292313)
      const poMatch = line.match(/(?:Customer\s*PO|Cust\.?\s*PO|PO)(?:\s*Number|\s*No\.?)?\s*[:\.-]?\s*([A-Z0-9-]+)/i) ||
                      line.match(/Customer\s*[:\.-]\s*([A-Z0-9-]+)/i);
      if (poMatch && !customerPoNo) {
        const val = poMatch[1].trim();
        if (!/delivery|order|pick|route/i.test(val)) {
          customerPoNo = val;
        }
      }

      // Delivery Date (e.g. Delivery Date: 7/3/26 or 3/29/24Delivery Date:)
      const delDateMatch = line.match(/Delivery\s*Date\s*[:\.-]?\s*([\d/-]+)/i) ||
                           line.match(/([\d/-]+)\s*Delivery\s*Date/i);
      if (delDateMatch && !deliveryDate) {
        deliveryDate = delDateMatch[1].trim();
      }

      // Deliver To Name & Delivery Address (e.g., Customer: 292313 Delivery Address: MITRA 10 GATOT SUBROTO BALI)
      const delAddrMatch = line.match(/(?:Deliver\s*To|Delivery\s*Addr(?:ess)?|Ship\s*To)\s*[:\.-]?\s*(.*)$/i);
      if (delAddrMatch && deliverToIndex === -1) {
        deliverToIndex = i;
        const inlineName = delAddrMatch[1].trim();
        if (inlineName) {
          deliverToName = inlineName;
          addressLineStart = i + 1;
        } else {
          deliverToName = (lines[i + 1] || "").trim();
          addressLineStart = i + 2;
        }
      }
    }

    // Extract address lines following deliverToName
    if (addressLineStart !== -1 && addressLineStart < lines.length) {
      const addrLines: string[] = [];
      for (let j = addressLineStart; j < lines.length; j++) {
        const line = lines[j];
        if (/^(?:Order|Pick|Customer|Route|Date|Location|Part|Qty|Loc|Page|Total|Created|Printed|Consolidated)/i.test(line)) {
          break;
        }
        addrLines.push(line);
      }
      deliverToAddress = addrLines.join(", ");
    }

    // Clean deliverToName if it is prefixed with "Delivery Address"
    if (/^Delivery\s*Address/i.test(deliverToName)) {
      const parts = deliverToAddress.split(", ").map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        deliverToName = parts[0];
        deliverToAddress = parts.slice(1).join(", ");
      }
    }

    // Parse items
    const rawItems = [];
    let scanningItems = false;

    for (const line of lines) {
      if (/Location\s*No|Part\s*Number|Description|Lot\/Batch/i.test(line)) {
        scanningItems = true;
        continue;
      }

      if (/Total\s*Quantity/i.test(line) || /Total\s*Gross\s*Weight/i.test(line)) {
        scanningItems = false;
        continue;
      }

      if (!scanningItems) continue;

      let productCode = "";
      
      // Step 1: Check if line contains any known code as a token
      const tokens = line.split(/\s+/);
      for (const t of tokens) {
        const cleanToken = t.replace(/[^A-Z0-9]/ig, "");
        if (knownCodes.has(cleanToken)) {
          productCode = cleanToken;
          break;
        }
      }
      
      // Step 2: Fall back to 7-12 character alphanumeric code pattern
      if (!productCode) {
        for (const t of tokens) {
          const clean = t.replace(/[^A-Z0-9]/ig, "");
          if (/^[A-Z0-9]{7,12}$/i.test(clean)) {
            // Exclude location codes like AL0101 and table label keywords
            if (!/^[A-Z]{2}\d{4}[P]?$/i.test(clean) && !/^(LOCATION|PART|NUMBER|DESCRIPTION|QUANTITY|CATCH|TOTAL)/i.test(clean)) {
              productCode = clean;
              break;
            }
          }
        }
      }
      
      if (!productCode) continue;

      const parts = line.split(productCode);
      if (parts.length < 2) continue;
      const after = parts[1].trim();

      const afterTokens = after.split(/\s+/).filter(Boolean);
      if (afterTokens.length === 0) continue;

      const lastToken = afterTokens.pop() || "";
      const delQtyPcs = parseInt(lastToken, 10) || 0;

      // Pop off any trailing "*" or empty tokens (Pallet Id column)
      while (afterTokens.length > 0 && (afterTokens[afterTokens.length - 1] === "*" || afterTokens[afterTokens.length - 1] === "")) {
        afterTokens.pop();
      }

      let lotBatchNo = "";
      if (afterTokens.length > 0) {
        const potentialBatch = afterTokens[afterTokens.length - 1];
        const isPaintSize = /^\d+(?:\.\d+)?L$/i.test(potentialBatch);
        const hasDigitsOrSymbols = /[\d-*:]{4,}/.test(potentialBatch);
        
        if (hasDigitsOrSymbols && !isPaintSize) {
          lotBatchNo = afterTokens.pop() || "";
        }
      }

      const productName = afterTokens.join(" ").trim();
      
      rawItems.push({
        productCode,
        productName,
        lotBatchNo,
        delQtyPcs
      });
    }

    // Enrich items with database product info
    const enrichedItems = await Promise.all(
      rawItems.map(async (item) => {
        let dbProduct = await prisma.product.findFirst({
          where: { productCode: item.productCode, isActive: true }
        });

        let existsInDb = true;
        const originalParsedCode = item.productCode;
        let matchedProductCode = item.productCode;

        if (!dbProduct) {
          existsInDb = false;
          const allProducts = await prisma.product.findMany({
            where: { isActive: true },
            select: { productCode: true, productName: true, sizeLiter: true }
          });
          
          let bestScore = Infinity;
          let bestMatch: any = null;

          for (const p of allProducts) {
            const codeDist = getLevenshteinDistance(item.productCode, p.productCode);
            const parsedName = item.productName || "";
            const dbName = p.productName || "";
            const nameDist = getLevenshteinDistance(parsedName.toUpperCase(), dbName.toUpperCase());
            
            const score = codeDist * 1000 + nameDist;
            
            if (score < bestScore) {
              bestScore = score;
              bestMatch = p;
            }
          }
          
          if (bestMatch && bestScore < 3000) {
            dbProduct = bestMatch;
            matchedProductCode = bestMatch.productCode;
          }
        }

        const name = dbProduct?.productName || item.productName;
        const sizeLiter = dbProduct?.sizeLiter || null;
        
        let calculatedLiter = 0;
        if (sizeLiter) {
          calculatedLiter = roundFloat(item.delQtyPcs * sizeLiter, 2);
        } else {
          const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*L(?:iter)?\b/i);
          if (sizeMatch) {
            const parsedSize = parseFloat(sizeMatch[1]);
            calculatedLiter = roundFloat(item.delQtyPcs * parsedSize, 2);
          }
        }

        return {
          productCode: matchedProductCode,
          originalParsedCode,
          productName: name,
          lotBatchNo: item.lotBatchNo,
          delQtyPcs: item.delQtyPcs,
          delQtyLiter: calculatedLiter,
          existsInDb
        };
      })
    );

    return NextResponse.json({
      dtNumber,
      orderNumber,
      customerPoNo,
      deliverToName,
      deliverToAddress,
      deliveryDate,
      items: enrichedItems
    });
  } catch (error: any) {
    console.error("PDF/Image Parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Levenshtein distance algorithm to find closest string match
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}
