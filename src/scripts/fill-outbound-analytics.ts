import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting non-destructive outbound analytics fill...");

  // Fetch all draft delivery orders
  const draftDOs = await prisma.deliveryOrder.findMany({
    where: { status: "draft" }
  });

  if (draftDOs.length < 5) {
    console.log(`⚠️ Found only ${draftDOs.length} draft DOs. Script requires at least 5 draft DOs to partition them.`);
    return;
  }

  const now = new Date();

  // Update first 3 to "delivered"
  for (let i = 0; i < 3; i++) {
    const doItem = draftDOs[i];
    await prisma.deliveryOrder.update({
      where: { id: doItem.id },
      data: {
        status: "delivered",
        createdAt: now,
        deliveryDate: now,
        shippedAt: now,
        deliveredAt: now
      }
    });
    console.log(`✅ Updated ${doItem.doNumber} to 'delivered' status.`);
  }

  // Update next 2 to "on_delivery"
  for (let i = 3; i < 5; i++) {
    const doItem = draftDOs[i];
    await prisma.deliveryOrder.update({
      where: { id: doItem.id },
      data: {
        status: "on_delivery",
        createdAt: now,
        deliveryDate: now,
        shippedAt: now
      }
    });
    console.log(`✅ Updated ${doItem.doNumber} to 'on_delivery' status.`);
  }

  console.log("🎉 Database analytics fill complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
