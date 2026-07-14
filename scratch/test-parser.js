function parseJotunPickListText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
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
  const items = [];
  
  // Simulated database product codes for testing
  const knownCodes = new Set([
    "2GXMAWUVA", "2Y1001WVA", "2GD001UVA", "2AJ001WVA"
  ]);

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
        lotBatchNo = afterTokens.pop() || "";
      }
    }

    const productName = afterTokens.join(" ").trim();
    
    items.push({
      productCode,
      productName,
      lotBatchNo,
      delQtyPcs
    });
  }

  return {
    dtNumber,
    orderNumber,
    customerPoNo,
    deliverToName,
    deliverToAddress,
    deliveryDate,
    createdDate,
    items
  };
}

// Test case using the exact OCR text from the user
const testText2 = `
Location No Part Number Description Lot/Batch No Pallet Id Quantity Catch Qty
AG0304P 2GXMAWUVA JOTASHIELD AF COLOURS BASE A 18L 3376067-1-*-1:2 * 24
AG1103 2GXMAWUVA JOTASHIELD AF COLOURS BASE A 18L 3376067-1-*-1:2 * 24
AG2805P 2GXMAWUVA JOTASHIELD AF COLOURS BASE A 18L 3362580-1-*-1:2 * 24
AG3404P 2GXMAWUVA JOTASHIELD AF COLOURS BASE A 18L 3376066-1-*-1:2 * 2
AG4803 2GXMAWUVA JOTASHIELD AF COLOURS BASE A 18L 3362580-1-*-1:2 * 6
AH0203 2Y1001WVA MAJESTIC PRIMER 20L 3355442-1-*-1:2 * 2
AH0204P 2GD001UVA JOTAPLAST PRIMER 18L 3380421-1-*-1:2 * 18
AH0804P 2GD001UVA JOTAPLAST PRIMER 18L 3380421-1-*-1:2 * 24
AH0903 2GD001UVA JOTAPLAST PRIMER 18L 3380421-1-*-1:2 * 8
AH4304P 2AJ001WVA JOTASHIELD PRIMER 20L 3362627-1-*-1:2 * 9
AH4404P 2AJ001WVA JOTASHIELD PRIMER 20L 3362627-1-*-1:2 * 1
AH4803 2Y1001WVA MAJESTIC PRIMER 20L 3355441-1-*-1:2 * 8
Total Quantity: 150
Total Gross Weight: 3819.1
PT JOTUN INDONESIA
41608513
Pick List
Pick List: TRIYOTPrinted by:
Delivery Address:
ARTHA KENCANA JAYA
JL.NGAGEL JAYA SELATAN NO.134
BARATAJAYA, GUBENG
SURABAYA
KOTA SURABAYA JAWA TIMUR 60286
INDONESIA
Created:
Customer: 296943
3/29/24Delivery Date:
Order Number: W14494382 7/14/26 12:19:40 PM
Route Id: IDD1SBY1
Consolidated Pick List for Customer Order IFS Applications PageReport: 1 (1)
`;

console.log("Parsed result:", JSON.stringify(parseJotunPickListText(testText2), null, 2));
