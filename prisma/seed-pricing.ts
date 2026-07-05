import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_RATES = [
  {
    key: "handling_out",
    label: "Handling Out Fee",
    description: "Biaya handling keluar per liter produk",
    unit: "/Liter",
    unitPrice: 500,
  },
  {
    key: "picking",
    label: "Picking Fee",
    description: "Biaya picking warehouse per pcs item",
    unit: "/Pcs",
    unitPrice: 2000,
  },
  {
    key: "storage",
    label: "Storage Fee",
    description: "Biaya penyimpanan palet per pallet",
    unit: "/Pallet",
    unitPrice: 50000,
  },
  {
    key: "delivery",
    label: "Delivery Fee",
    description: "Biaya transportasi pengiriman per trip",
    unit: "/Trip",
    unitPrice: 350000,
  },
  {
    key: "admin",
    label: "Administration Fee",
    description: "Biaya administrasi dokumen (fixed)",
    unit: "Fixed",
    unitPrice: 25000,
  },
];

async function main() {
  console.log("Seeding default pricing rates...");

  for (const rate of DEFAULT_RATES) {
    const existing = await prisma.pricingRate.findUnique({ where: { key: rate.key } });
    if (!existing) {
      await prisma.pricingRate.create({ data: rate });
      console.log(`  ✓ Created: ${rate.label} (${rate.key})`);
    } else {
      console.log(`  – Skipped (exists): ${rate.label}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
