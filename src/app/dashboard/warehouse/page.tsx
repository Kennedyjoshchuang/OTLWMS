import { prisma } from "@/lib/prisma";
import WarehouseMapClient from "./WarehouseMapClient";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const racks = await prisma.warehouseRack.findMany({
    include: {
      positions: {
        include: {
          stockLedgers: {
            include: { product: true }
          }
        },
        orderBy: [
          { rowNumber: 'asc' },
          { levelNumber: 'asc' },
          { positionNumber: 'asc' }
        ]
      }
    },
    orderBy: { rackCode: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Warehouse Layout Map</h1>
        <p className="text-slate-500 mt-1">Interactive visualization of Omega Trust Logistik warehouse.</p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <WarehouseMapClient initialRacks={racks} />
      </div>
    </div>
  );
}
