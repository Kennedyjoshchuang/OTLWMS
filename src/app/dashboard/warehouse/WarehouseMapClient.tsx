"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Search, Layers, ArchiveRestore } from "lucide-react";

export default function WarehouseMapClient({ initialRacks }: { initialRacks: any[] }) {
  const [selectedRack, setSelectedRack] = useState<any | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [search, setSearch] = useState("");

  const handleRackClick = (rack: any) => {
    setSelectedRack(rack);
    setSelectedLevel(1);
  };

  const getRackStatus = (rack: any) => {
    const occupied = rack.positions.filter((p: any) => p.isOccupied).length;
    const capacity = rack.totalPositions;
    const percent = Math.round((occupied / capacity) * 100);
    return { occupied, capacity, percent };
  };

  const renderRackBox = (rackCode: string, className: string, label?: string) => {
    const rack = initialRacks.find(r => r.rackCode === rackCode);
    if (!rack) return null;
    const status = getRackStatus(rack);
    
    let bgColor = "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50";
    if (status.percent > 80) bgColor = "bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/50";
    if (status.percent > 95) bgColor = "bg-red-500/20 hover:bg-red-500/30 border-red-500/50";
    if (rack.rackType === "floor") bgColor = "bg-red-500/10 hover:bg-red-500/20 border-red-500/40";

    return (
      <div 
        onClick={() => handleRackClick(rack)}
        className={`cursor-pointer transition-all border-2 rounded-md flex items-center justify-center flex-col relative overflow-hidden group ${bgColor} ${className}`}
      >
        <div 
          className="absolute bottom-0 left-0 right-0 bg-black/10 transition-all duration-500" 
          style={{ height: `${status.percent}%` }}
        />
        <span className="font-bold text-slate-800 z-10 text-lg group-hover:scale-110 transition-transform">
          {label || rackCode}
        </span>
        <span className="text-xs text-slate-600 font-medium z-10">{status.percent}% Full</span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search product code or position..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
        <div className="flex gap-4 text-sm font-medium text-slate-600">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Available</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> &gt;80% Full</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Full</div>
        </div>
      </div>

      <div className="bg-slate-100 rounded-3xl p-8 overflow-x-auto border-2 border-dashed border-slate-300">
        <div className="min-w-[800px] h-[600px] relative mx-auto bg-white rounded-xl shadow-sm border p-8 flex flex-col justify-between">
          
          {/* Top Area: Floor Storage (Red) */}
          <div className="w-full flex justify-center mb-8">
            {renderRackBox("FLOOR", "w-3/4 h-20", "FLOOR STORAGE (RED)")}
          </div>

          <div className="flex-1 flex justify-between px-12">
            {/* Left Rack A */}
            <div className="h-full flex flex-col justify-center">
              {renderRackBox("A", "w-24 h-96")}
            </div>

            {/* Middle Racks B & C */}
            <div className="h-full flex gap-1 justify-center items-center">
              {renderRackBox("B", "w-20 h-[420px]")}
              {renderRackBox("C", "w-20 h-[420px]")}
            </div>

            {/* Right Racks D & E */}
            <div className="h-full flex gap-1 justify-center items-center">
              {renderRackBox("D", "w-20 h-96")}
              {renderRackBox("E", "w-20 h-96")}
            </div>
          </div>
          
          {/* Charging Station mock */}
          <div className="absolute bottom-8 right-8 w-32 h-24 border-2 border-dashed border-slate-400 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 text-xs font-semibold text-center p-2">
            Restruck Charging Station
          </div>
        </div>
      </div>

      <Dialog open={!!selectedRack} onOpenChange={(open) => !open && setSelectedRack(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Layers className="w-6 h-6 text-primary" />
              {selectedRack?.rackName} Details
            </DialogTitle>
          </DialogHeader>

          {selectedRack && (
            <div className="mt-4">
              <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg w-max">
                {Array.from({ length: selectedRack.totalLevels }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedLevel(i + 1)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                      selectedLevel === i + 1 
                        ? 'bg-white shadow-sm text-primary' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    Level {i + 1}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {selectedRack.positions
                  .filter((p: any) => p.levelNumber === selectedLevel)
                  .map((pos: any) => {
                    const isMatched = search && (pos.positionCode.toLowerCase().includes(search.toLowerCase()) || 
                      pos.stockLedgers.some((s: any) => s.product.productCode.toLowerCase().includes(search.toLowerCase()) || 
                      s.product.productName.toLowerCase().includes(search.toLowerCase())));
                      
                    return (
                      <div 
                        key={pos.id} 
                        className={`p-3 rounded-xl border-2 flex flex-col gap-2 transition-colors ${
                          pos.isOccupied 
                            ? isMatched ? 'border-amber-400 bg-amber-50' : 'border-primary/30 bg-primary/5' 
                            : isMatched ? 'border-amber-400 bg-amber-50' : 'border-dashed border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded shadow-sm border">
                            {pos.positionCode}
                          </span>
                          {pos.isOccupied && <Package className="w-4 h-4 text-primary" />}
                        </div>
                        
                        {pos.isOccupied && pos.stockLedgers[0] ? (
                          <div className="mt-1 flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-slate-600 line-clamp-1" title={pos.stockLedgers[0].product.productName}>
                              {pos.stockLedgers[0].product.productName}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {pos.stockLedgers[0].quantity} pcs <span className="text-slate-400 font-normal">({pos.stockLedgers[0].quantityLiter}L)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 bg-slate-200/70 rounded px-1 w-max">
                              Batch: {pos.stockLedgers[0].batchNumber || 'N/A'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400">
                            <span className="text-xs font-medium">Empty</span>
                          </div>
                        )}
                      </div>
                    )
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
