import { PrismaClient } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const dateStr = "2026-07-13";
  const tzEndDate = endOfDay(parseISO(dateStr));
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  const targetCodes = ["6BYMAWCMF", "6JHMAASMA", "6BXMAWCMF", "2Y1001WVA"];

  for (const code of targetCodes) {
    console.log(`\n=== Product: ${code} ===`);
    const product = await prisma.product.findFirst({ where: { productCode: code } });
    if (!product) continue;

    // Ledgers lte July 13
    const ledgers = await prisma.stockLedger.findMany({
      where: { productId: product.id, inboundDate: { lte: prismaEndDate } },
      include: { palletPosition: { include: { rack: true } } }
    });
    console.log(`Ledgers lte July 13:`);
    for (const l of ledgers) {
      console.log(`  - Ledger ID: ${l.id}, Qty Now: ${l.quantity}, InboundDate: ${l.inboundDate.toISOString()}, Position: ${l.palletPosition?.positionCode}`);
    }

    // Movements after July 13
    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, createdAt: { gt: prismaEndDate } }
    });
    console.log(`Movements after July 13:`);
    for (const m of movements) {
      console.log(`  - Movement ID: ${m.id}, Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}, Created: ${m.createdAt.toISOString()}, PosId: ${m.palletPositionId}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
