const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting warehouse pallet position retrofit migration...');

  // 1. Fetch all active stock ledgers
  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      palletPosition: {
        include: { rack: true }
      }
    }
  });

  console.log(`🔍 Found ${stockLedgers.length} active stock ledger entries to inspect.`);

  const updates = [];
  const logDetails = [];

  for (const ledger of stockLedgers) {
    const pos = ledger.palletPosition;
    if (!pos) continue;
    
    const rack = pos.rack;
    if (!rack) continue;

    const rackCode = rack.rackCode;
    const oldRow = pos.rowNumber;
    const level = pos.levelNumber;

    // Skip floor positions as they are not inverted
    if (rackCode === 'FLOOR') {
      continue;
    }

    // Calculate the inverted row number
    let newRow;
    if (rackCode === 'E') {
      newRow = 17 - oldRow;
    } else {
      newRow = 15 - oldRow;
    }

    if (oldRow === newRow) {
      // Row is symmetric (e.g. Row 7 of 14, 15 - 7 = 8, wait, no, symmetric is none for 14, wait, for 15 it's 8 -> 17-8 = 9, so symmetric is none)
      // If it evaluates to the same, skip updating to avoid redundant queries
      continue;
    }

    // Find the target pallet position in the database
    const targetPos = await prisma.palletPosition.findFirst({
      where: {
        rackId: rack.id,
        rowNumber: newRow,
        levelNumber: level
      }
    });

    if (!targetPos) {
      console.warn(`⚠️ Target position not found for Rack ${rackCode}, newRow ${newRow}, Level ${level}`);
      continue;
    }

    logDetails.push({
      ledgerId: ledger.id,
      rackCode,
      oldRow,
      newRow,
      level,
      oldCode: pos.positionCode,
      newCode: targetPos.positionCode
    });

    // Queue update for StockLedger
    updates.push(
      prisma.stockLedger.update({
        where: { id: ledger.id },
        data: { palletPositionId: targetPos.id }
      })
    );
  }

  if (updates.length === 0) {
    console.log('✅ No retrofit updates needed for existing stock.');
  } else {
    console.log(`🚀 Executing ${updates.length} stock ledger pallet swaps...`);
    logDetails.forEach(detail => {
      console.log(`   - Ledger ${detail.ledgerId}: Rack ${detail.rackCode} Row ${detail.oldRow} (${detail.oldCode}) ➡️ Row ${detail.newRow} (${detail.newCode}) at Level ${detail.level}`);
    });

    // Perform the swaps in a transaction
    await prisma.$transaction(updates);
    console.log('✅ Stock ledger swaps completed successfully.');
  }

  // 2. Recalculate and sync isOccupied for all pallet positions
  console.log('⚙️ Recalculating pallet position occupancy states...');

  // Get ids of positions that have active stock after the migration
  const activePositions = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    select: { palletPositionId: true }
  });
  
  const occupiedIds = Array.from(new Set(activePositions.map(ap => ap.palletPositionId)));

  // First, mark all positions as unoccupied
  await prisma.palletPosition.updateMany({
    data: { isOccupied: false }
  });

  // Next, mark positions with active stock as occupied
  await prisma.palletPosition.updateMany({
    where: { id: { in: occupiedIds } },
    data: { isOccupied: true }
  });

  console.log(`✅ Pallet position occupancy synchronized. ${occupiedIds.length} positions are marked occupied.`);
  console.log('🎉 Retrofit migration complete!');
}

main()
  .catch(err => {
    console.error('❌ Retrofit migration failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
