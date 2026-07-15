import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking DT items matching 2GX...");
  const items = await prisma.deliveryTicketItem.findMany({
    where: {
      productCode: {
        contains: "2GX",
      },
    },
    include: {
      deliveryTicket: true,
      product: true,
    },
  });

  console.log(`Found ${items.length} items:`);
  for (const item of items) {
    console.log(`- DT Item ID: ${item.id}`);
    console.log(`  DT Number: ${item.deliveryTicket.dtNumber}`);
    console.log(`  Product Code in DT: ${item.productCode}`);
    console.log(`  Product ID in DT: ${item.productId}`);
    console.log(`  Product is Active: ${item.product?.isActive}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
