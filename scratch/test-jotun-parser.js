function parseJotunPickListText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  let dtNumber = "";
  let orderNumber = "";
  let customerPoNo = "";
  let deliverToName = "";
  let deliverToAddress = "";
  let deliveryDate = "";
  
  let deliverToIndex = -1;
  let addressLineStart = -1;

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

    // Customer / PO Number
    const poMatch = line.match(/(?:Customer\s*PO|Cust\.?\s*PO|PO)(?:\s*Number|\s*No\.?)?\s*[:\.-]?\s*([A-Z0-9-]+)/i) ||
                    line.match(/Customer\s*[:\.-]\s*([A-Z0-9-]+)/i);
    if (poMatch && !customerPoNo) {
      const val = poMatch[1].trim();
      if (!/delivery|order|pick|route/i.test(val)) {
        customerPoNo = val;
      }
    }

    // Delivery Date
    const delDateMatch = line.match(/Delivery\s*Date\s*[:\.-]?\s*([\d/-]+)/i) ||
                         line.match(/([\d/-]+)\s*Delivery\s*Date/i);
    if (delDateMatch && !deliveryDate) {
      deliveryDate = delDateMatch[1].trim();
    }

    // Delivery Address & Deliver To Name
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

  // If deliverToIndex was found, gather remaining address lines until metadata or header block
  if (addressLineStart !== -1 && addressLineStart < lines.length) {
    const addrLines = [];
    for (let j = addressLineStart; j < lines.length; j++) {
      const line = lines[j];
      if (/^(?:Order|Pick|Customer|Route|Date|Location|Part|Qty|Loc|Page|Total|Created|Printed|Consolidated)/i.test(line)) {
        break;
      }
      addrLines.push(line);
    }
    deliverToAddress = addrLines.join(", ");
  }

  // Parse items
  const items = [];
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
    
    // Check line for alphanumeric product code token (e.g. 27B9REBVA, 9 chars or [A-Z0-9]{8,12})
    const tokens = line.split(/\s+/);
    for (const t of tokens) {
      const clean = t.replace(/[^A-Z0-9]/ig, "");
      if (/^[A-Z0-9]{7,12}$/i.test(clean)) {
        // Exclude location codes if they match pattern like AL0101
        if (!/^[A-Z]{2}\d{4}[P]?$/i.test(clean) && !/^(LOCATION|PART|NUMBER|DESCRIPTION|QUANTITY|CATCH|TOTAL)/i.test(clean)) {
          productCode = clean;
          break;
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
    if (delQtyPcs > 0 || productName) {
      items.push({
        productCode,
        productName,
        lotBatchNo,
        delQtyPcs
      });
    }
  }

  return {
    dtNumber,
    orderNumber,
    customerPoNo,
    deliverToName,
    deliverToAddress,
    deliveryDate,
    items
  };
}

const sample1 = `
PT. Jotun Indonesia
Pick List
Order Number: W20320827 Created: 7/28/26 3:38:14 PM
Pick List: 54408835 Printed by: SUGIOMU Delivery Date: 7/3/26
Customer: 292313 Delivery Address: MITRA 10 GATOT SUBROTO BALI
JL. GATOT SUBROTO BARAT NO. 405
DENPASAR, BALI
0361-418148
INDONESIA
Route Id: IDD1BALI1
Location No Part Number Description Lot/Batch No Pallet Id Quantity Catch Qty
AL0101 27B9REBVA MULTICOLOR COLORANT RE 1L 7035217379 * 1
Total Quantity: 1
Total Gross Weight: 2.08
`;

const sample2 = `
PT. Jotun Indonesia
Pick List
Order Number: W20273968 Created: 7/28/26 3:38:14 PM
Pick List: 54408834 Printed by: SUGIOMU Delivery Date: 6/26/26
Customer: 292313 Delivery Address: MITRA 10 BYPASS BALI
JL. BY PASS NGURAH RAI 840-842
DENPASAR, BALI
0361-724888
INDONESIA
Route Id: IDD1BALI1
Location No Part Number Description Lot/Batch No Pallet Id Quantity Catch Qty
AL0101 27B9REBVA MULTICOLOR COLORANT RE 1L 7035217379 * 1
Total Quantity: 1
Total Gross Weight: 2.08
`;

console.log("Sample 1 Output:\n", JSON.stringify(parseJotunPickListText(sample1), null, 2));
console.log("Sample 2 Output:\n", JSON.stringify(parseJotunPickListText(sample2), null, 2));
