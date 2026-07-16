import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting update of historical InboundReceipt totalLiterReceived values...");

  const receipts = await prisma.inboundReceipt.findMany();
  let updatedCount = 0;

  for (const receipt of receipts) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        movementType: "inbound",
        referenceType: "inbound_receipt",
        referenceId: receipt.id
      },
      include: { product: true }
    });

    const recalculatedLiter = movements.reduce((sum, m) => {
      const size = m.product?.sizeLiter || 0;
      return sum + (m.quantity * size);
    }, 0);

    const diff = Math.abs(receipt.totalLiterReceived - recalculatedLiter);
    if (diff > 0.001) {
      console.log(`Updating Receipt ${receipt.receiptNumber}:`);
      console.log(`  Old totalLiterReceived: ${receipt.totalLiterReceived} L`);
      console.log(`  New totalLiterReceived: ${recalculatedLiter} L`);
      
      await prisma.inboundReceipt.update({
        where: { id: receipt.id },
        data: { totalLiterReceived: recalculatedLiter }
      });
      updatedCount++;
    }
  }

  console.log(`\nUpdate Completed! Corrected ${updatedCount} InboundReceipt records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
