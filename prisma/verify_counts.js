const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const counts = await Promise.all([
    prisma.user.count().then(n => ['User', n]),
    prisma.customer.count().then(n => ['Customer', n]),
    prisma.product.count().then(n => ['Product', n]),
    prisma.packingList.count().then(n => ['PackingList', n]),
    prisma.inboundReceipt.count().then(n => ['InboundReceipt', n]),
    prisma.stockLedger.count().then(n => ['StockLedger', n]),
    prisma.deliveryTicket.count().then(n => ['DeliveryTicket', n]),
    prisma.deliveryOrder.count().then(n => ['DeliveryOrder', n]),
    prisma.dOPickingItem.count().then(n => ['DOPickingItem', n]),
    prisma.invoice.count().then(n => ['Invoice', n]),
    prisma.pricingRate.count().then(n => ['PricingRate', n]),
    prisma.warehouseRack.count().then(n => ['WarehouseRack', n]),
    prisma.palletPosition.count().then(n => ['PalletPosition', n]),
  ]);
  counts.forEach(([t, c]) => console.log(t + ': ' + c));
  await prisma.$disconnect();
}
main();
