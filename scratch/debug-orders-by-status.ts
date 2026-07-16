import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing delivery orders by status...");

  const statuses = ["draft", "picking", "ready_to_ship", "on_delivery", "partially_delivered", "delivered", "cancelled"];

  for (const status of statuses) {
    const orders = await prisma.deliveryOrder.findMany({
      where: { status },
      include: {
        pickingItems: {
          include: { product: true }
        }
      }
    });

    let totalPcs = 0;
    let totalLiters = 0;
    for (const order of orders) {
      for (const item of order.pickingItems) {
        totalPcs += item.pickedQty;
        totalLiters += item.pickedQty * (item.product?.sizeLiter || 0);
      }
    }

    console.log(`Status: ${status}`);
    console.log(`  Count: ${orders.length}`);
    console.log(`  Picked Pcs: ${totalPcs}`);
    console.log(`  Picked Liters: ${totalLiters} L`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
