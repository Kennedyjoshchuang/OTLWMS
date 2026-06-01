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
      { id: 'user-whadmin',    email: 'wh@omegaTrust.id',    passwordHash: hash('Admin@123'), fullName: 'Budi Santoso', role: 'warehouse_admin', phone: '08111000002' },
      { id: 'user-checker',   email: 'checker@omegaTrust.id',passwordHash: hash('Admin@123'), fullName: 'Andi Checker', role: 'checker_inbound', phone: '08111000003' },
      { id: 'user-picker',    email: 'picker@omegaTrust.id', passwordHash: hash('Admin@123'), fullName: 'Rudi Picker',  role: 'picker', phone: '08111000004' },
      { id: 'user-driver',    email: 'driver@omegaTrust.id', passwordHash: hash('Admin@123'), fullName: 'Sinaga Driver', role: 'driver', phone: '08111000005' },
      { id: 'user-customer',  email: 'jotun@jotun.com',     passwordHash: hash('Admin@123'), fullName: 'Putri Andini (Jotun)', role: 'customer_viewer', phone: '08111000006' },
    ],
  })

  // ─── CUSTOMER ────────────────────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: { code: 'JOTUN-001' },
    update: {},
    create: {
      id: 'cust-jotun',
      code: 'JOTUN-001',
      name: 'PT. Jotun Indonesia',
      address: 'Jl. Bungur Lot 296, Batamindo Industrial Park, Muka Kuning, Batam 29432, Kepulauan Riau Indonesia',
      contactName: 'Putri Andini',
      contactPhone: '+62 770 612784',
      contactEmail: 'jotun@jotun.com',
    },
  })

  // ─── PRODUCTS ────────────────────────────────────────────────────
  await prisma.product.createMany({
    data: [
      { id: 'prod-01', customerId: customer.id, productCode: '2W6001FVA', productName: 'GARDEX PREMIUM GLOSS WHITE', paintType: 'Premium Gloss', colorName: 'WHITE', colorCode: 'FVA', sizeLiter: 5, weightKg: 6.0, barcode: '8993510026001' },
      { id: 'prod-02', customerId: customer.id, productCode: '2W6001FVB', productName: 'GARDEX PREMIUM GLOSS WHITE', paintType: 'Premium Gloss', colorName: 'WHITE', colorCode: 'FVB', sizeLiter: 2.5, weightKg: 3.1, barcode: '8993510026002' },
      { id: 'prod-03', customerId: customer.id, productCode: '2W6005FAA', productName: 'GARDEX PREMIUM GLOSS MEDIUM GREY', paintType: 'Premium Gloss', colorName: 'MEDIUM GREY', colorCode: 'FAA', sizeLiter: 5, weightKg: 6.1, barcode: '8993510026003' },
      { id: 'prod-04', customerId: customer.id, productCode: '2W6010FAB', productName: 'GARDEX PREMIUM GLOSS DEEP BLUE', paintType: 'Premium Gloss', colorName: 'DEEP BLUE', colorCode: 'FAB', sizeLiter: 5, weightKg: 6.2, barcode: '8993510026004' },
      { id: 'prod-05', customerId: customer.id, productCode: '2I5001FAA', productName: 'JOTAPLAST INTERIOR MATT WHITE', paintType: 'Interior Matt', colorName: 'WHITE', colorCode: 'FAA', sizeLiter: 5, weightKg: 5.8, barcode: '8993510025001' },
      { id: 'prod-06', customerId: customer.id, productCode: '2I5001FAB', productName: 'JOTAPLAST INTERIOR MATT WHITE', paintType: 'Interior Matt', colorName: 'WHITE', colorCode: 'FAB', sizeLiter: 2.5, weightKg: 2.9, barcode: '8993510025002' },
      { id: 'prod-07', customerId: customer.id, productCode: '2E4001FAA', productName: 'JOTASHIELD EXTERIOR ULTRA WHITE', paintType: 'Exterior', colorName: 'ULTRA WHITE', colorCode: 'FAA', sizeLiter: 5, weightKg: 6.5, barcode: '8993510024001' },
      { id: 'prod-08', customerId: customer.id, productCode: '2E4002FAA', productName: 'JOTASHIELD EXTERIOR IVORY', paintType: 'Exterior', colorName: 'IVORY', colorCode: 'FAA', sizeLiter: 5, weightKg: 6.4, barcode: '8993510024002' },
      { id: 'prod-09', customerId: customer.id, productCode: '2P3001FAA', productName: 'JOTUN PRIMER UNIVERSAL RED OXIDE', paintType: 'Primer', colorName: 'RED OXIDE', colorCode: 'FAA', sizeLiter: 5, weightKg: 7.0, barcode: '8993510023001' },
      { id: 'prod-10', customerId: customer.id, productCode: '2W7001FAA', productName: 'JOTUN MAJESTIC WHISPER WHITE', paintType: 'Premium Emulsion', colorName: 'WHISPER WHITE', colorCode: 'FAA', sizeLiter: 5, weightKg: 5.9, barcode: '8993510027001' },
    ],
  })

  // ─── WAREHOUSE RACKS ─────────────────────────────────────────────
  // Layout: A=72PP(4L,18pos), B=128PP(4L,32pos), C=128PP(4L,32pos)
  //         D=120PP(4L,30pos), E=120PP(4L,30pos), FLOOR=32PP(1L,32pos)
  const racks = [
    { id: 'rack-A',     rackCode: 'A',     rackName: 'Rack A', rackType: 'rack',  totalRows: 18, totalLevels: 4,  totalPositions: 72,  colorHex: '#22c55e' },
    { id: 'rack-B',     rackCode: 'B',     rackName: 'Rack B', rackType: 'rack',  totalRows: 32, totalLevels: 4,  totalPositions: 128, colorHex: '#22c55e' },
    { id: 'rack-C',     rackCode: 'C',     rackName: 'Rack C', rackType: 'rack',  totalRows: 32, totalLevels: 4,  totalPositions: 128, colorHex: '#22c55e' },
    { id: 'rack-D',     rackCode: 'D',     rackName: 'Rack D', rackType: 'rack',  totalRows: 30, totalLevels: 4,  totalPositions: 120, colorHex: '#22c55e' },
    { id: 'rack-E',     rackCode: 'E',     rackName: 'Rack E', rackType: 'rack',  totalRows: 30, totalLevels: 4,  totalPositions: 120, colorHex: '#22c55e' },
    { id: 'rack-FLOOR', rackCode: 'FLOOR', rackName: 'Floor Storage (Red)', rackType: 'floor', totalRows: 32, totalLevels: 1, totalPositions: 32, colorHex: '#ef4444' },
  ]

  for (const rack of racks) {
    await prisma.warehouseRack.upsert({ where: { rackCode: rack.rackCode }, update: {}, create: rack })
  }

  // ─── PALLET POSITIONS ─────────────────────────────────────────────
  console.log('📦 Generating 352 pallet positions...')
  const rackConfigs = [
    { code: 'A', rows: 18, levels: 4 },
    { code: 'B', rows: 32, levels: 4 },
    { code: 'C', rows: 32, levels: 4 },
    { code: 'D', rows: 30, levels: 4 },
    { code: 'E', rows: 30, levels: 4 },
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

  // ─── SAMPLE STOCK (for demo) ──────────────────────────────────────
  console.log('📊 Creating sample stock data...')
  const samplePositions = ['A-01-01-01','A-01-02-01','A-01-03-01','A-02-01-01','B-01-01-01','B-01-02-01','B-02-01-01','C-01-01-01']
  const sampleProducts  = ['prod-01','prod-01','prod-03','prod-05','prod-07','prod-02','prod-08','prod-10']
  const sampleBatches   = ['4112282-1','4184787-1','3912001-1','4001234-1','4200001-1','4112282-2','4300001-1','4400001-1']

  for (let i = 0; i < samplePositions.length; i++) {
    const pos = await prisma.palletPosition.findUnique({ where: { positionCode: samplePositions[i] } })
    if (!pos) continue
    const existing = await prisma.stockLedger.findFirst({ where: { palletPositionId: pos.id } })
    if (existing) continue
    await prisma.stockLedger.create({
      data: {
        productId: sampleProducts[i],
        palletPositionId: pos.id,
        batchNumber: sampleBatches[i],
        quantity: Math.floor(Math.random() * 20) + 5,
        quantityLiter: (Math.floor(Math.random() * 20) + 5) * 5,
        inboundDate: new Date(Date.now() - i * 86400000 * 3),
      },
    })
    await prisma.palletPosition.update({ where: { id: pos.id }, data: { isOccupied: true } })
  }

  // ─── SAMPLE DT (from Jotun DT 15923331) ──────────────────────────
  const dt = await prisma.deliveryTicket.upsert({
    where: { customerId_dtNumber: { customerId: 'cust-jotun', dtNumber: '15923331' } },
    update: {},
    create: {
      id: 'dt-sample-1',
      customerId: 'cust-jotun',
      dtNumber: '15923331',
      delnoteNumber: '42641334',
      orderNumber: 'W19682451',
      customerPoNo: 'WEBDECO PO/WBI/26/01016',
      deliverToName: 'PT. WISCO BANGUNAN INDONESIA',
      deliverToAddress: 'Industri Estate Batam Center, RT.000 RW.000 Baloi Permai, Batam Kota, Indonesia',
      invoiceToName: 'PT. WISCO BANGUNAN INDONESIA',
      shipFromWhse: 'IDD0',
      haulierCompany: 'SINAGA',
      orderDate: new Date('2026-03-27'),
      deliveryDate: new Date('2026-03-27'),
      totalGrossKg: 74.28,
      totalNetKg: 69.48,
      totalPcs: 12,
      totalLiter: 60,
      totalPallets: 1,
      ocrStatus: 'completed',
      status: 'ready',
      createdById: 'user-whadmin',
    },
  })

  await prisma.deliveryTicketItem.createMany({
    data: [
      { deliveryTicketId: dt.id, lineNo: 1, productId: 'prod-01', productCode: '2W6001FVA', productName: 'GARDEX PREMIUM GLOSS WHITE 5L', lotBatchNo: '4112282-1-*-1:2', handlingUnitId: '38929350065961306', delQtyPcs: 10, delQtyLiter: 50, delQtyKg: 57.90, status: 'pending' },
      { deliveryTicketId: dt.id, lineNo: 2, productId: 'prod-01', productCode: '2W6001FVA', productName: 'GARDEX PREMIUM GLOSS WHITE 5L', lotBatchNo: '4184787-1-*-1:2', handlingUnitId: '38929350065961307', delQtyPcs: 2,  delQtyLiter: 10, delQtyKg: 11.58, status: 'pending' },
    ],
  })

  console.log('✅ Seed selesai! Total:')
  console.log('   👤 6 users | 🏢 1 customer | 📦 10 products')
  console.log('   🏭 6 racks | 📍 352 pallet positions')
  console.log('   📋 1 sample DT (Jotun 15923331)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
