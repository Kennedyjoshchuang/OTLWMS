import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Omega Trust Logistik WMS...')

  // ─── USERS ───────────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hashSync(p, 10)

  await prisma.user.createMany({
    data: [
      { id: 'user-superadmin', email: 'admin@omegaTrust.id', passwordHash: hash('Admin@123'), fullName: 'Super Admin', role: 'super_admin', phone: '08111000001' },
    ],
  })

  // ─── WAREHOUSE RACKS ─────────────────────────────────────────────
  // Layout: A=72PP(4L,18pos), B=64PP(4L,16pos), C=64PP(4L,16pos)
  //         D=60PP(4L,15pos), E=60PP(4L,15pos), FLOOR=32PP(1L,32pos)
  // Total: 352 PP
  const racks = [
    { id: 'rack-A',     rackCode: 'A',     rackName: 'Rack A', rackType: 'rack',  totalRows: 18, totalLevels: 4,  totalPositions: 72,  colorHex: '#22c55e' },
    { id: 'rack-B',     rackCode: 'B',     rackName: 'Rack B', rackType: 'rack',  totalRows: 16, totalLevels: 4,  totalPositions: 64,  colorHex: '#22c55e' },
    { id: 'rack-C',     rackCode: 'C',     rackName: 'Rack C', rackType: 'rack',  totalRows: 16, totalLevels: 4,  totalPositions: 64,  colorHex: '#22c55e' },
    { id: 'rack-D',     rackCode: 'D',     rackName: 'Rack D', rackType: 'rack',  totalRows: 15, totalLevels: 4,  totalPositions: 60,  colorHex: '#22c55e' },
    { id: 'rack-E',     rackCode: 'E',     rackName: 'Rack E', rackType: 'rack',  totalRows: 15, totalLevels: 4,  totalPositions: 60,  colorHex: '#22c55e' },
    { id: 'rack-FLOOR', rackCode: 'FLOOR', rackName: 'Floor Storage (Red)', rackType: 'floor', totalRows: 32, totalLevels: 1, totalPositions: 32, colorHex: '#ef4444' },
  ]

  for (const rack of racks) {
    await prisma.warehouseRack.upsert({ where: { rackCode: rack.rackCode }, update: {}, create: rack })
  }

  // ─── PALLET POSITIONS ─────────────────────────────────────────────
  console.log('📦 Generating 352 pallet positions...')
  const rackConfigs = [
    { code: 'A', rows: 18, levels: 4 },
    { code: 'B', rows: 16, levels: 4 },
    { code: 'C', rows: 16, levels: 4 },
    { code: 'D', rows: 15, levels: 4 },
    { code: 'E', rows: 15, levels: 4 },
    { code: 'FLOOR', rows: 32, levels: 1 },
  ]

  for (const cfg of rackConfigs) {
    const rack = await prisma.warehouseRack.findUnique({ where: { rackCode: cfg.code } })
    if (!rack) continue
    for (let row = 1; row <= cfg.rows; row++) {
      for (let level = 1; level <= cfg.levels; level++) {
        const posCode = `${cfg.code}-${String(row).padStart(2,'0')}-${String(level).padStart(2,'0')}-01`
        await prisma.palletPosition.upsert({
          where: { positionCode: posCode },
          update: {},
          create: {
            rackId: rack.id,
            rowNumber: row,
            levelNumber: level,
            positionNumber: 1,
            positionCode: posCode,
            maxCapacity: 1,
            isOccupied: false,
          },
        })
      }
    }
  }

  console.log('✅ Seed selesai! Total:')
  console.log('   👤 1 super_admin user')
  console.log('   🏭 6 racks | 📍 352 pallet positions')
}

main().catch(console.error).finally(() => prisma.$disconnect())
