import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dts = await prisma.deliveryTicket.findMany({
    take: 5,
    include: {
      items: true,
      customer: true
    }
  });

  console.log("Delivery Tickets Count:", dts.length);
  console.log("Delivery Tickets:", JSON.stringify(dts, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
