import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Querying details for 2GXMAWUVA and 2GXMAWAWUVA...");

  const products = await prisma.product.findMany({
    where: {
      productCode: {
        in: ["2GXMAWUVA", "2GXMAWAWUVA"],
      },
    },
    include: {
      stockLedgers: {
        where: { quantity: { gt: 0 } },
        include: {
          palletPosition: true,
        },
      },
      dtItems: {
        include: {
          deliveryTicket: true,
        },
      },
    },
  });

  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
