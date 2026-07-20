import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundFloat } from "@/lib/utils";
import { PDFParse } from "pdf-parse";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";

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

    // Parse PDF text using PDFParse class
    const parser = new PDFParse({ data: buffer });
    const parsedPdf = await parser.getText();
    const text: string = parsedPdf.text || "";

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
    
    // Extract fields line-by-line using regular expressions
    for (const line of lines) {
      // DT / Pick List Number
      // Pattern 1: Standalone 8-digit number (Jotun DTs are typically 8 digits, e.g. 41608513)
      if (/^\d{8}$/.test(line) && !dtNumber) {
        dtNumber = line;
      }
      // Pattern 2: Standard Pick List: 12345
      const dtMatch = line.match(/(?:Pick\s*List|Picking\s*List)(?:\s*No\.?)?\s*[:\.-]\s*([A-Z0-9-]+)/i) ||
                      line.match(/(?:Pick\s*List|Picking\s*List)(?:\s*No\.?)?\s+([A-Z0-9-]+)/i);
      if (dtMatch && !dtNumber) {
        const val = dtMatch[1].trim();
        if (!/printed/i.test(val)) {
          dtNumber = val;
        }
      }

      // Order Number and Created Date (sometimes merged: "Order Number: W14494382 7/14/26 12:19:40 PM")
      const orderMatch = line.match(/Order(?:\s*Number|\s*No\.?)?\s*[:\.-]\s*([A-Z0-9-]+)(?:\s+([\d/: ]+(?:AM|PM)?))?/i) ||
                         line.match(/Order(?:\s*Number|\s*No\.?)?\s+([A-Z0-9-]+)/i);
      if (orderMatch && !orderNumber) {
        orderNumber = orderMatch[1].trim();
        if (orderMatch[2] && !createdDate) {
          createdDate = orderMatch[2].trim();
        }
      }

      // Customer / PO Number
      const poMatch = line.match(/(?:Customer\s*PO|Cust\.?\s*PO|PO)(?:\s*Number|\s*No\.?)?\s*[:\.-]\s*([A-Z0-9-]+)/i) ||
                      line.match(/(?:Customer\s*PO|Cust\.?\s*PO|PO)(?:\s*Number|\s*No\.?)?\s+([A-Z0-9-]+)/i) ||
                      line.match(/^Customer\s*[:\.-]\s*([A-Z0-9-]+)$/i);
      if (poMatch && !customerPoNo) {
        customerPoNo = poMatch[1].trim();
      }

      // Delivery Date (sometimes merged: "3/29/24Delivery Date:")
      const delDateMatch = line.match(/([\d/-]+)\s*Delivery\s*Date/i) ||
                           line.match(/Delivery\s*Date\s*[:\.-]\s*([\d/-]+)/i);
      if (delDateMatch && !deliveryDate) {
        deliveryDate = delDateMatch[1].trim();
      }
    }

    // Find Deliver To / Delivery Address
    let deliverToIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^(?:Deliver\s*To|Delivery\s*Addr(?:ess)?|Ship\s*To)/i.test(lines[i])) {
        deliverToIndex = i;
        break;
      }
    }

    if (deliverToIndex !== -1) {
      const line = lines[deliverToIndex];
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1 && line.substring(colonIdx + 1).trim()) {
        deliverToName = line.substring(colonIdx + 1).trim();
        let addrLines = [];
        for (let j = deliverToIndex + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (/Order|Pick|Customer|Route|Date|Part|Qty|Loc|Page|Total|Created|Printed/i.test(nextLine)) {
            break;
          }
          addrLines.push(nextLine);
        }
        deliverToAddress = addrLines.join(", ");
      } else {
        deliverToName = lines[deliverToIndex + 1] || "";
        let addrLines = [];
        for (let j = deliverToIndex + 2; j < lines.length; j++) {
          const nextLine = lines[j];
          if (/Order|Pick|Customer|Route|Date|Part|Qty|Loc|Page|Total|Created|Printed/i.test(nextLine)) {
            break;
          }
          addrLines.push(nextLine);
        }
        deliverToAddress = addrLines.join(", ");
      }
    }

    // Clean up deliverToName if it matches "Delivery Address" or "Delivery Address:"
    if (/^Delivery\s*Address/i.test(deliverToName)) {
      const addrParts = deliverToAddress.split(", ").map(p => p.trim()).filter(Boolean);
      if (addrParts.length > 0) {
        deliverToName = addrParts[0];
        deliverToAddress = addrParts.slice(1).join(", ");
      }
    }

    // Parse items
    const rawItems = [];
    let stopScanningItems = false;

    for (const line of lines) {
      if (/Total\s*Quantity/i.test(line) || /Total\s*Gross\s*Weight/i.test(line)) {
        stopScanningItems = true;
        continue;
      }

      if (stopScanningItems) {
        continue;
      }

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
      
      // Step 2: Fall back to 9-char code pattern
      if (!productCode) {
        const prodCodeMatch = line.match(/\b[A-Z0-9]{9}\b/);
        if (prodCodeMatch) {
          productCode = prodCodeMatch[0];
        }
      }
      
      if (!productCode) continue;

      // Filter out common labels
      if (/^(ORDER|CUSTOMER|PICKLIST|DELIVER|DELIVERY|ROUTE|CREATED|DATE|DESCRIPTION|BATCH|QUANTITY|TOTAL|SOURCE)/i.test(productCode)) {
        continue;
      }

      const parts = line.split(productCode);
      const after = parts[1].trim();

      const numbers = after.match(/\d+/g);
      if (!numbers) continue;
      
      const afterTokens = after.split(/\s+/);
      const lastToken = afterTokens.pop() || ""; // quantity
      const delQtyPcs = parseInt(lastToken, 10) || 0;

      // Pop off any tailing "*" or empty tokens (like Pallet Id column)
      while (afterTokens.length > 0 && (afterTokens[afterTokens.length - 1] === "*" || afterTokens[afterTokens.length - 1] === "")) {
        afterTokens.pop();
      }

      let lotBatchNo = "";
      if (afterTokens.length > 0) {
        const potentialBatch = afterTokens[afterTokens.length - 1];
        const isPaintSize = /^\d+(?:\.\d+)?L$/i.test(potentialBatch);
        const hasDigitsOrSymbols = /[\d-*:]{4,}/.test(potentialBatch);
        
        if (hasDigitsOrSymbols && !isPaintSize) {
          afterTokens.pop(); // Remove the batch token so it does not get joined into productName
        }
      }

      const productName = afterTokens.join(" ").trim();
      
      rawItems.push({
        productCode,
        productName,
        lotBatchNo: "", // Explicitly set to empty/removed
        delQtyPcs
      });
    }

    // Enrich items with database product info
    const enrichedItems = await Promise.all(
      rawItems.map(async (item) => {
        // Query product details from database
        let dbProduct = await prisma.product.findFirst({
          where: { productCode: item.productCode, isActive: true }
        });

        let existsInDb = true;
        const originalParsedCode = item.productCode;
        let matchedProductCode = item.productCode;

        if (!dbProduct) {
          existsInDb = false;
          // Find closest product code from the database using Levenshtein distance
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
            
            // Composite score: prioritizing code matching (weight 1000) while description breaks ties
            const score = codeDist * 1000 + nameDist;
            
            if (score < bestScore) {
              bestScore = score;
              bestMatch = p;
            }
          }
          
          if (bestMatch) {
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
          // Fallback to parse size from name
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
      items: enrichedItems
    });
  } catch (error: any) {
    console.error("PDF Parsing error:", error);
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
