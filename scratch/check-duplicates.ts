import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for duplicate products (same customerId & productCode)...");
  const products = await prisma.product.findMany();
  
  const map = new Map<string, any[]>();
  for (const p of products) {
    const key = `${p.customerId}_${p.productCode}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(p);
  }

  let duplicates = 0;
  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      duplicates++;
      console.log(`Duplicate found for key ${key}:`);
      for (const p of list) {
        console.log(`- ID: ${p.id}, Name: ${p.productName}, Active: ${p.isActive}, Created: ${p.createdAt}`);
      }
    }
  }

  console.log(`Total duplicate groups: ${duplicates}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
