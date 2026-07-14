const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check2GX() {
  try {
    const products = await prisma.product.findMany({
      where: {
        productCode: {
          contains: '2GX'
        }
      }
    });
    console.log('Products matching 2GX:', JSON.stringify(products, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check2GX();
