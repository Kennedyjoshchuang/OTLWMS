const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listProducts() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        productCode: true,
        productName: true,
        sizeLiter: true
      }
    });
    console.log(`Total products: ${products.length}`);
    console.log('Sample products:', JSON.stringify(products.slice(0, 20), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

listProducts();
