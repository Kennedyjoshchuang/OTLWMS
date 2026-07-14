import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      productCode: true,
      productName: true,
      sizeLiter: true
    }
  });

  console.log("Products count:", products.length);
  console.log("Sample products:", products.slice(0, 20));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
