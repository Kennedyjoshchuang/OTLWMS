import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== All Inbound Receipts in DB ===");
  const receipts = await prisma.inboundReceipt.findMany({
    orderBy: { receivedDate: "asc" }
  });
  for (const r of receipts) {
    console.log(`GRN: ${r.receiptNumber}, Date: ${r.receivedDate.toISOString()}, Liters: ${r.totalLiterReceived} L`);
  }

  console.log("\n=== All Delivery Orders with non-zero deliveredQty ===");
  const dos = await prisma.deliveryOrder.findMany({
    include: {
      deliveryTicket: {
        include: { items: { include: { product: true } } }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  for (const o of dos) {
    const vol = o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.deliveredQty * (it.product?.sizeLiter || 0)), 0) || 0;
    if (vol > 0) {
      console.log(`DO: ${o.doNumber}, Status: ${o.status}, Vol: ${vol}L, CreatedAt: ${o.createdAt.toISOString()}, DelAt: ${o.deliveredAt?.toISOString()}, ShippedAt: ${o.shippedAt?.toISOString()}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
