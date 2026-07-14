const { PrismaClient } = require("@prisma/client");

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
  console.log("Sample products:", JSON.stringify(products.slice(0, 30), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
