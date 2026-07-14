const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        productCode: {
          contains: '27A'
        }
      }
    });
    console.log('Product containing 27A:', product);
    
    const exact = await prisma.product.findFirst({
      where: {
        productCode: '27A9BFBVA'
      }
    });
    console.log('Exact 27A9BFBVA:', exact);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkProduct();
