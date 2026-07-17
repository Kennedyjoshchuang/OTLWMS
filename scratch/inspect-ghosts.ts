import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ghostIds = [
    "cmrmsday4004fn0nqnefz8dw5",
    "cmrmsif92005fn0nqbu19pw11",
    "cmrmt4cs9006en0nqh4v4vv4e",
    "cmrms77hx003bn0nqiyxnu44u",
    "cmrms7nrp003gn0nqc7t72e98",
    "cmrmsi1p3005an0nq40284uwh"
  ];

  console.log("=== Inspecting Ghost Movements ===");
  const movements = await prisma.stockMovement.findMany({
    where: { id: { in: ghostIds } }
  });

  for (const m of movements) {
    let orderStatus = "N/A";
    if (m.referenceType === "delivery_order" && m.referenceId) {
      const order = await prisma.deliveryOrder.findUnique({
        where: { id: m.referenceId }
      });
      orderStatus = order ? order.status : "Not Found";
    }
    console.log(`Movement ID: ${m.id}, Product: ${m.productId}, Type: ${m.movementType}, Qty: ${m.quantity}, RefType: ${m.referenceType}, RefId: ${m.referenceId}, OrderStatus: ${orderStatus}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
