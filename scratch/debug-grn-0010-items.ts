import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const receipt = await prisma.inboundReceipt.findFirst({
    where: { receiptNumber: "GRN-2026-0010" },
    include: {
      packingList: {
        include: {
          items: {
            include: { product: true }
          }
        }
      }
    }
  });

  if (!receipt) {
    console.log("GRN-2026-0010 not found.");
    return;
  }

  console.log("Receipt:", {
    receiptNumber: receipt.receiptNumber,
    receivedDate: receipt.receivedDate,
    totalPcsReceived: receipt.totalPcsReceived,
    totalLiterReceived: receipt.totalLiterReceived,
    status: receipt.status,
  });

  if (receipt.packingList) {
    console.log("\nPacking List Items:");
    for (const item of receipt.packingList.items) {
      console.log(`- Item ID: ${item.id}`);
      console.log(`  Product Code: ${item.productCode}, Name: ${item.productName}`);
      console.log(`  Expected Qty: ${item.expectedQty}, Expected Liter: ${item.expectedLiter}`);
      console.log(`  Actual Qty: ${item.actualQty}, Actual Liter: ${item.actualLiter}`);
      console.log(`  Status: ${item.status}`);
      if (item.product) {
        console.log(`  Product Size (from Product model): ${item.product.sizeLiter}`);
      } else {
        console.log(`  Product size: NONE (product is null)`);
      }
    }
  } else {
    console.log("\nNo associated Packing List.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
