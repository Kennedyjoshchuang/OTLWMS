import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding inactive products with stock and their active counterparts...");

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      product: {
        include: { customer: true },
      },
      palletPosition: true,
    },
  });

  const inactiveProductsInStock = new Map<string, any>();
  for (const sl of stockLedgers) {
    if (!sl.product.isActive) {
      inactiveProductsInStock.set(sl.productId, sl.product);
    }
  }

  console.log(`Found ${inactiveProductsInStock.size} unique inactive products with stock.`);

  for (const [id, product] of inactiveProductsInStock.entries()) {
    console.log(`\nInactive Product: ${product.productCode} (ID: ${id})`);
    console.log(`  Name: ${product.productName}`);
    console.log(`  Customer: ${product.customer.name} (ID: ${product.customerId})`);
    console.log(`  Barcode: ${product.barcode}`);

    // Look for active products that are similar (same customer and similar code, or same barcode, or same name)
    const activeCounterparts = await prisma.product.findMany({
      where: {
        customerId: product.customerId,
        isActive: true,
        OR: [
          { barcode: product.barcode && product.barcode !== "" ? product.barcode : undefined },
          { productCode: { contains: product.productCode.substring(0, 5) } },
          { productName: { contains: product.productName.substring(0, 15) } },
        ],
      },
    });

    console.log(`  Active counterparts found: ${activeCounterparts.length}`);
    for (const ac of activeCounterparts) {
      console.log(`    - Code: ${ac.productCode} (ID: ${ac.id})`);
      console.log(`      Name: ${ac.productName}`);
      console.log(`      Barcode: ${ac.barcode}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
