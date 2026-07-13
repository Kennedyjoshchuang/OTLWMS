"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Search, Layers, MapPin, Activity, Info, AlertTriangle, CheckCircle2, Pencil, Save, Undo, Loader2, RefreshCw, Move, ArrowRightLeft } from "lucide-react";
import { getDisplayRowNumber, hasWriteAccess } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface WarehouseMapClientProps {
  initialRacks: any[];
}

export default function WarehouseMapClient({ initialRacks }: WarehouseMapClientProps) {
  const [racks, setRacks] = useState<any[]>(initialRacks);

  const [selectedCell, setSelectedCell] = useState<{
    rackCode: string;
    rowNumber: number;
    positions: any[];
  } | null>(null);

  const [hoveredCell, setHoveredCell] = useState<{
    rackCode: string;
    rowNumber: number;
    positions: any[];
    x: number;
    y: number;
  } | null>(null);

  const [search, setSearch] = useState("");


  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editRackName, setEditRackName] = useState("");
  const [editPositionCodes, setEditPositionCodes] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Fetching & sync state
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const { data: session } = useSession();
  const canWrite = session?.user ? hasWriteAccess(session.user as any, "/dashboard/warehouse") : false;

  // Move Item state
  const [movingItem, setMovingItem] = useState<{ ledger: any; currentPosition: any } | null>(null);
  const [selectedMoveRack, setSelectedMoveRack] = useState("");
  const [selectedMoveRow, setSelectedMoveRow] = useState("");
  const [selectedMoveLevel, setSelectedMoveLevel] = useState("");
  const [moveSearchQuery, setMoveSearchQuery] = useState("");
  const [moveQty, setMoveQty] = useState("");
  const [selectedTargetPositionId, setSelectedTargetPositionId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  // Flat list of all positions (excluding the currently selected position) for target selection
  const allPositions = useMemo(() => {
    return racks.flatMap(r =>
      r.positions.map((p: any) => ({
        ...p,
        rackCode: r.rackCode,
        rackName: r.rackName,
      }))
    );
  }, [racks]);

  // Filtered target positions for moving
  const filteredTargetPositions = useMemo(() => {
    if (!movingItem) return [];
    let list = allPositions.filter((p) => p.id !== movingItem.currentPosition.id);

    if (selectedMoveRack) {
      list = list.filter((p) => p.rackCode === selectedMoveRack);
    }
    if (selectedMoveRow) {
      list = list.filter((p) => getDisplayRowNumber(p.rackCode, p.rowNumber) === Number(selectedMoveRow));
    }
    if (selectedMoveLevel) {
      list = list.filter((p) => p.levelNumber === Number(selectedMoveLevel));
    }
    if (moveSearchQuery) {
      const q = moveSearchQuery.toLowerCase();
      list = list.filter((p) => p.positionCode.toLowerCase().includes(q));
    }
    return list;
  }, [allPositions, movingItem, selectedMoveRack, selectedMoveRow, selectedMoveLevel, moveSearchQuery]);

  const moveRowOptions = useMemo(() => {
    if (!selectedMoveRack) return [];
    const rackPositions = allPositions.filter(p => p.rackCode === selectedMoveRack);
    const displayRows = rackPositions.map(p => getDisplayRowNumber(selectedMoveRack, p.rowNumber));
    // Unique, sorted ascending, and positive
    const uniqueRows = Array.from(new Set(displayRows))
      .filter(r => r > 0)
      .sort((a, b) => a - b);
    return uniqueRows;
  }, [allPositions, selectedMoveRack]);

  const moveLevelOptions = useMemo(() => {
    if (!selectedMoveRack) return [];
    const rackObj = racks.find(r => r.rackCode === selectedMoveRack);
    if (!rackObj) return [];
    const levels = [];
    for (let i = 1; i <= rackObj.totalLevels; i++) {
      levels.push(i);
    }
    return levels;
  }, [racks, selectedMoveRack]);

  const handleStartMove = (ledger: any, currentPosition: any) => {
    setMovingItem({ ledger, currentPosition });
    setMoveQty(String(ledger.quantity));
    setSelectedMoveRack("");
    setSelectedMoveRow("");
    setSelectedMoveLevel("");
    setMoveSearchQuery("");
    setSelectedTargetPositionId("");
    setMoveError("");
  };

  const handleConfirmMove = async () => {
    if (!movingItem || !selectedTargetPositionId) return;
    setIsMoving(true);
    setMoveError("");
    try {
      const res = await fetch("/api/warehouse/move-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockLedgerId: movingItem.ledger.id,
          targetPositionId: selectedTargetPositionId,
          moveQty: Number(moveQty),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to move item.");
      }

      // Success! Sync map layout
      await fetchLayout(false);
      setMovingItem(null);
      // Close the details cell modal so they see the updated map
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Error moving item:", err);
      setMoveError(err.message || "Failed to move item.");
    } finally {
      setIsMoving(false);
    }
  };

  const fetchLayout = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/warehouse/layout");
      if (!res.ok) {
        throw new Error("Failed to fetch latest warehouse layout.");
      }
      const data = await res.json();
      setRacks(data);
    } catch (err: any) {
      console.error("Error fetching warehouse layout:", err);
      setFetchError(err.message || "Failed to load layout.");
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  // Fetch layout on mount to ensure we have the latest synced product data
  useEffect(() => {
    fetchLayout(true);
  }, [fetchLayout]);

  // 1. Calculate Warehouse Statistics
  const stats = useMemo(() => {
    let total = 0;
    let occupied = 0;
    let totalLiters = 0;
    racks.forEach(rack => {
      total += rack.totalPositions;
      occupied += rack.positions.filter((p: any) => p.isOccupied).length;
      rack.positions.forEach((p: any) => {
        p.stockLedgers.forEach((sl: any) => {
          totalLiters += sl.quantity * (sl.product?.sizeLiter || 0);
        });
      });
    });
    return {
      total,
      occupied,
      available: total - occupied,
      rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      totalLiters
    };
  }, [racks]);

  // Helper to get positions for a specific rack and row
  const getCellData = (rackCode: string, rowNumber: number) => {
    const rack = racks.find(r => r.rackCode === rackCode);
    if (!rack) return { rack: null, positions: [], occupiedCount: 0, totalCount: 0, percent: 0 };
    const positions = rack.positions.filter((p: any) => p.rowNumber === rowNumber);
    const occupiedCount = positions.filter((p: any) => p.isOccupied).length;
    const totalCount = positions.length || 1;
    const percent = Math.round((occupiedCount / totalCount) * 100);
    return { rack, positions, occupiedCount, totalCount, percent };
  };

  const getLevelName = (rack: any, levelNumber: number) => {
    if (!rack) return `LEVEL ${levelNumber}`;
    if (!rack.levelAliases) return `LEVEL ${levelNumber}`;
    try {
      const aliases = typeof rack.levelAliases === "string" ? JSON.parse(rack.levelAliases) : rack.levelAliases;
      return aliases[String(levelNumber)] || `LEVEL ${levelNumber}`;
    } catch (e) {
      return `LEVEL ${levelNumber}`;
    }
  };

  const startEditing = () => {
    if (!selectedCell) return;
    const { rack } = getCellData(selectedCell.rackCode, selectedCell.rowNumber);
    if (!rack) return;
    setEditRackName(rack.rackName);
    
    // Initialize position code inputs for each position in this cell
    const initialPosCodes: Record<string, string> = {};
    selectedCell.positions.forEach(pos => {
      initialPosCodes[pos.id] = pos.positionCode;
    });
    setEditPositionCodes(initialPosCodes);
    setEditError("");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCell) return;
    const { rack } = getCellData(selectedCell.rackCode, selectedCell.rowNumber);
    if (!rack) return;
    setIsSavingEdit(true);
    setEditError("");
    try {
      // 1. Update Rack Name
      if (editRackName !== rack.rackName) {
        const resRack = await fetch(`/api/warehouse/racks/${rack.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rackName: editRackName }),
        });
        if (!resRack.ok) throw new Error("Failed to update rack name.");
      }

      // 2. Update Position Codes
      const positionsToUpdate = Object.keys(editPositionCodes).map(id => ({
        id,
        positionCode: editPositionCodes[id]
      }));
      
      const resPos = await fetch(`/api/warehouse/positions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: positionsToUpdate }),
      });
      if (!resPos.ok) {
        const errorData = await resPos.json();
        throw new Error(errorData.error || "Failed to update position numbering.");
      }

      setRacks((prev) =>
        prev.map((r) => {
          if (r.id === rack.id) {
            return {
              ...r,
              rackName: editRackName,
              positions: r.positions.map((p: any) => {
                if (editPositionCodes[p.id]) {
                  return { ...p, positionCode: editPositionCodes[p.id] };
                }
                return p;
              })
            };
          }
          return r;
        })
      );
      
      // Update the selectedCell state so UI refreshes without closing
      setSelectedCell(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          positions: prev.positions.map(p => {
            if (editPositionCodes[p.id]) {
              return { ...p, positionCode: editPositionCodes[p.id] };
            }
            return p;
          })
        };
      });
      
      setIsEditing(false);
      // Fetch latest layout in the background to ensure absolute sync with backend
      fetchLayout(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 2. Define Floor Cell Coordinates (viewBox y: 0 to 6)
  // Total Width = 14.5m, Total Height = 27m
  const FLOOR_CELLS = useMemo(() => {
    const cells = [];
    const innerLeft = 2.65; // centered horizontally

    // 1 to 10: Outer top row (horizontal)
    // 10 cells * 1.2m = 12.0m width. Centered: (14.5 - 12.0) / 2 = 1.25m
    for (let r = 1; r <= 10; r++) {
      cells.push({
        rowNumber: r,
        x: 1.25 + (r - 1) * 1.2,
        y: 0.0,
        w: 1.2,
        h: 1.0,
        type: "floor_outer_top"
      });
    }

    // 11 to 13: Outer left column (vertical)
    // 3 cells * 1.2m height = 3.6m. Starts at y = 1.2m, x = 0.0
    for (let r = 11; r <= 13; r++) {
      cells.push({
        rowNumber: r,
        x: 0.0,
        y: 1.2 + (r - 11) * 1.2,
        w: 1.0,
        h: 1.2,
        type: "floor_outer_left"
      });
    }

    // 14 to 16: Outer right column (vertical)
    // 3 cells * 1.2m height = 3.6m. Starts at y = 1.2m, x = 13.5m
    for (let r = 14; r <= 16; r++) {
      cells.push({
        rowNumber: r,
        x: 13.5,
        y: 1.2 + (r - 14) * 1.2,
        w: 1.0,
        h: 1.2,
        type: "floor_outer_right"
      });
    }

    // 17 to 24: Inner top row (8 cells)
    // Cell 1 (left vertical: 1.0m w, 1.2m h) + 6 middle horizontal (1.2m w, 1.0m h) + Cell 8 (right vertical: 1.0m w, 1.2m h)
    // Total width = 1.0 + 7.2 + 1.0 = 9.2m. Centered: (14.5 - 9.2) / 2 = 2.65m
    cells.push({ rowNumber: 17, x: innerLeft, y: 2.0, w: 1.0, h: 1.2, type: "floor_inner_top_left" });
    for (let r = 18; r <= 23; r++) {
      cells.push({
        rowNumber: r,
        x: innerLeft + 1.0 + (r - 18) * 1.2,
        y: 2.0,
        w: 1.2,
        h: 1.0,
        type: "floor_inner_top_mid"
      });
    }
    cells.push({ rowNumber: 24, x: innerLeft + 8.2, y: 2.0, w: 1.0, h: 1.2, type: "floor_inner_top_right" });

    // 25 to 32: Inner bottom row (8 cells)
    cells.push({ rowNumber: 25, x: innerLeft, y: 3.6, w: 1.0, h: 1.2, type: "floor_inner_bottom_left" });
    for (let r = 26; r <= 31; r++) {
      cells.push({
        rowNumber: r,
        x: innerLeft + 1.0 + (r - 26) * 1.2,
        y: 3.6,
        w: 1.2,
        h: 1.0,
        type: "floor_inner_bottom_mid"
      });
    }
    cells.push({ rowNumber: 32, x: innerLeft + 8.2, y: 3.6, w: 1.0, h: 1.2, type: "floor_inner_bottom_right" });

    return cells;
  }, []);

  // 3. Define Rack Cell Coordinates (viewBox y: 6 to 24)
  const RACK_CELLS = useMemo(() => {
    const cells = [];

    // Row A: 14 cells, x = 2.75m. Spans y = 6.0 to 20.0
    for (let r = 1; r <= 14; r++) {
      cells.push({
        rackCode: "A",
        rowNumber: r,
        x: 2.75,
        y: 6.0 + (r - 1) * 1.0,
        w: 1.2,
        h: 1.0
      });
    }

    // Row B: 14 cells, x = 3.95m. Spans y = 6.0 to 20.0
    for (let r = 1; r <= 14; r++) {
      cells.push({
        rackCode: "B",
        rowNumber: r,
        x: 3.95,
        y: 6.0 + (r - 1) * 1.0,
        w: 1.2,
        h: 1.0
      });
    }

    // Row C: 14 cells, x = 7.9m. Spans y = 6.0 to 20.0
    for (let r = 1; r <= 14; r++) {
      cells.push({
        rackCode: "C",
        rowNumber: r,
        x: 7.9,
        y: 6.0 + (r - 1) * 1.0,
        w: 1.2,
        h: 1.0
      });
    }

    // Row D: 14 cells, x = 9.1m. Spans y = 6.0 to 20.0
    for (let r = 1; r <= 14; r++) {
      cells.push({
        rackCode: "D",
        rowNumber: r,
        x: 9.1,
        y: 6.0 + (r - 1) * 1.0,
        w: 1.2,
        h: 1.0
      });
    }

    // Row E: 16 cells, x = 13.05m. Spans y = 6.0 to 22.0
    for (let r = 1; r <= 16; r++) {
      cells.push({
        rackCode: "E",
        rowNumber: r,
        x: 13.05,
        y: 6.0 + (r - 1) * 1.0,
        w: 1.2,
        h: 1.0
      });
    }

    return cells;
  }, []);

  // 4. Search Filter Logic
  const isCellMatched = (positions: any[]) => {
    if (!search) return false;
    const s = search.toLowerCase();
    return positions.some((pos: any) => {
      if (pos.positionCode.toLowerCase().includes(s)) return true;
      return pos.stockLedgers.some((ledger: any) => {
        return (
          ledger.batchNumber?.toLowerCase().includes(s) ||
          ledger.product.productCode.toLowerCase().includes(s) ||
          ledger.product.productName.toLowerCase().includes(s)
        );
      });
    });
  };

  // Hover Tooltip Handlers
  const handleMouseMove = (e: React.MouseEvent, rackCode: string, rowNumber: number, positions: any[]) => {
    const container = e.currentTarget.closest(".map-container");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    // Position tooltip slightly offset from mouse cursor
    setHoveredCell({
      rackCode,
      rowNumber,
      positions,
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top + 15,
    });
  };

  // Determine cell colors based on occupancy percentage
  const getCellColors = (percent: number, isFloor: boolean, isMatched: boolean) => {
    if (isMatched) {
      return {
        fill: "url(#glowGradient)",
        stroke: "#f59e0b",
        strokeWidth: 0.12,
        className: "animate-pulse shadow-lg cursor-pointer transition-all duration-300"
      };
    }

    if (isFloor) {
      // Floor Storage (Red) color scheme
      if (percent === 0) {
        return {
          fill: "#fef2f2",
          stroke: "#fca5a5",
          strokeWidth: 0.05,
          className: "hover:fill-red-100 hover:stroke-red-400 cursor-pointer transition-all duration-200"
        };
      } else {
        return {
          fill: "#fee2e2",
          stroke: "#ef4444",
          strokeWidth: 0.08,
          className: "hover:fill-red-200 cursor-pointer transition-all duration-200"
        };
      }
    } else {
      // Rack Storage (Green) color scheme based on occupancy
      if (percent === 0) {
        return {
          fill: "#f8fafc",
          stroke: "#e2e8f0",
          strokeWidth: 0.05,
          className: "hover:fill-slate-100 cursor-pointer transition-all duration-200"
        };
      } else if (percent < 80) {
        // Available (emerald)
        return {
          fill: "#d1fae5",
          stroke: "#10b981",
          strokeWidth: 0.06,
          className: "hover:fill-emerald-200 cursor-pointer transition-all duration-200"
        };
      } else if (percent < 100) {
        // >80% Full (orange)
        return {
          fill: "#ffedd5",
          stroke: "#f97316",
          strokeWidth: 0.07,
          className: "hover:fill-orange-200 cursor-pointer transition-all duration-200"
        };
      } else {
        // Full (red)
        return {
          fill: "#fee2e2",
          stroke: "#ef4444",
          strokeWidth: 0.08,
          className: "hover:fill-red-200 cursor-pointer transition-all duration-200"
        };
      }
    }
  };

  return (
    <div className="p-6 bg-slate-50/50">
      
      {/* ─── STATISTICS / KPI CARDS ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 transition-all hover:scale-[1.02]">
          <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">Total Capacity</p>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800">{stats.total} PP</h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 transition-all hover:scale-[1.02]">
          <div className="p-2.5 sm:p-3 bg-red-50 text-red-600 rounded-xl">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">Occupied</p>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800">{stats.occupied} PP</h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 transition-all hover:scale-[1.02]">
          <div className="p-2.5 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">Available</p>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800">{stats.available} PP</h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 transition-all hover:scale-[1.02]">
          <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1">Total Liters</p>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800">
              {stats.totalLiters.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} L
            </h3>
          </div>
        </div>
      </div>

      {/* ─── TOOLBAR & SEARCH ────────────────────────────────────── */}
      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span>{fetchError}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-6">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search product code, batch, or position..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-sm font-medium dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            onClick={() => fetchLayout(true)}
            disabled={isLoading}
            className="p-2.5 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-850 disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
            title="Sync/Refresh Map Data"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
        
        {/* Color Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 bg-white border px-4 py-2.5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#d1fae5] border border-[#10b981] rounded"></div>
            <span>Rack Available (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#ffedd5] border border-[#f97316] rounded"></div>
            <span>Rack &gt;80% Full</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#fee2e2] border border-[#ef4444] rounded"></div>
            <span>Rack Full (100%)</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#fef2f2] border border-[#fca5a5] rounded"></div>
            <span>Floor Storage Empty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#fee2e2] border border-[#ef4444] rounded"></div>
            <span>Floor Storage Occupied</span>
          </div>
        </div>
      </div>

      {/* ─── MAP CANVAS & LAYOUT ─────────────────────────────────── */}
      <div className="bg-white border rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col items-center">
        
        {/* Map Container */}
        <div className="map-container relative w-full overflow-visible max-w-[550px]">
          
          <svg 
            viewBox="-1.5 -1.0 17.5 28.5" 
            className="w-full h-auto drop-shadow-sm" 
            style={{ shapeRendering: "geometricPrecision" }}
          >
            {/* DEFINE GRADIENTS & PATTERNS */}
            <defs>
              <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f1f5f9" strokeWidth="0.03" />
              </pattern>
              
              <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="100%" stopColor="#fde68a" />
              </linearGradient>

              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
              </marker>
              <marker id="thick-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
              </marker>
            </defs>

            {/* Subtle Grid Background */}
            <rect x="-1.5" y="-1.0" width="17.5" height="28.5" fill="url(#grid)" />

            {/* 1. Structural Columns (Dashed Lines) */}
            {/* Verticals every 3.625m */}
            <line x1="3.625" y1="0" x2="3.625" y2="25.5" stroke="#e2e8f0" strokeWidth="0.04" strokeDasharray="0.1 0.1" />
            <line x1="7.25" y1="0" x2="7.25" y2="25.5" stroke="#e2e8f0" strokeWidth="0.04" strokeDasharray="0.1 0.1" />
            <line x1="10.875" y1="0" x2="10.875" y2="25.5" stroke="#e2e8f0" strokeWidth="0.04" strokeDasharray="0.1 0.1" />
            
            {/* Horizontals */}
            <line x1="0" y1="3.0" x2="14.5" y2="3.0" stroke="#e2e8f0" strokeWidth="0.04" strokeDasharray="0.1 0.1" />
            <line x1="0" y1="6.0" x2="14.5" y2="6.0" stroke="#94a3b8" strokeWidth="0.06" strokeDasharray="0.15 0.15" />
            <line x1="3.0" y1="22.5" x2="14.5" y2="22.5" stroke="#94a3b8" strokeWidth="0.06" strokeDasharray="0.15 0.15" />

            {/* 2. Warehouse Concrete Outer Walls */}
            <rect x="0" y="0" width="14.5" height="25.5" fill="none" stroke="#475569" strokeWidth="0.12" rx="0.1" />

            {/* 3. Restruck Charging Station */}
            <rect x="0" y="22.5" width="3.0" height="3.0" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.07" strokeDasharray="0.1 0.1" rx="0.15" />
            <text x="1.5" y="23.3" textAnchor="middle" fontSize="0.28" fontWeight="bold" fill="#64748b">Restruck</text>
            <text x="1.5" y="23.8" textAnchor="middle" fontSize="0.28" fontWeight="bold" fill="#64748b">charging</text>
            <text x="1.5" y="24.8" textAnchor="middle" fontSize="0.28" fontWeight="bold" fill="#64748b">station</text>

            {/* 4. Render Red Floor Storage Cells (32 cells) */}
            {FLOOR_CELLS.map((cell) => {
              const { positions, percent } = getCellData("FLOOR", cell.rowNumber);
              const matched = isCellMatched(positions);
              const colors = getCellColors(percent, true, matched);
              
              return (
                <rect
                  key={`floor-${cell.rowNumber}`}
                  x={cell.x}
                  y={cell.y}
                  width={cell.w}
                  height={cell.h}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={colors.strokeWidth}
                  className={colors.className}
                  onClick={() => setSelectedCell({ rackCode: "FLOOR", rowNumber: cell.rowNumber, positions })}
                  onMouseMove={(e) => handleMouseMove(e, "FLOOR", cell.rowNumber, positions)}
                  onMouseLeave={() => setHoveredCell(null)}
                  rx="0.06"
                />
              );
            })}

            {/* 5. Render Green Rack Cells (Rows A, B, C, D, E) */}
            {RACK_CELLS.map((cell) => {
              const { positions, percent } = getCellData(cell.rackCode, cell.rowNumber);
              const matched = isCellMatched(positions);
              const colors = getCellColors(percent, false, matched);

              return (
                <g key={`rack-${cell.rackCode}-${cell.rowNumber}`}>
                  <rect
                    x={cell.x}
                    y={cell.y}
                    width={cell.w}
                    height={cell.h}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={colors.strokeWidth}
                    className={colors.className}
                    onClick={() => setSelectedCell({ rackCode: cell.rackCode, rowNumber: cell.rowNumber, positions })}
                    onMouseMove={(e) => handleMouseMove(e, cell.rackCode, cell.rowNumber, positions)}
                    onMouseLeave={() => setHoveredCell(null)}
                    rx="0.06"
                  />
                  {/* Tiny row number text in center of cell */}
                  <text
                    x={cell.x + cell.w / 2}
                    y={cell.y + cell.h / 2 + 0.12}
                    textAnchor="middle"
                    fontSize="0.32"
                    fontWeight="bold"
                    fill="#475569"
                    className="select-none pointer-events-none opacity-60"
                  >
                    {getDisplayRowNumber(cell.rackCode, cell.rowNumber)}
                  </text>
                </g>
              );
            })}

            {/* 6. Rack Row Labels (Matching drawing layout) */}
            <text x="3.35" y="20.7" textAnchor="middle" fontSize="0.6" fontWeight="bold" fill="#1e293b">A</text>
            <text x="4.55" y="20.7" textAnchor="middle" fontSize="0.6" fontWeight="bold" fill="#1e293b">B</text>
            <text x="8.50" y="20.7" textAnchor="middle" fontSize="0.6" fontWeight="bold" fill="#1e293b">C</text>
            <text x="9.70" y="20.7" textAnchor="middle" fontSize="0.6" fontWeight="bold" fill="#1e293b">D</text>
            <text x="13.65" y="25.1" textAnchor="middle" fontSize="0.8" fontWeight="bold" fill="#000000">E</text>

            {/* 7. CAD Dimension Lines & Arrows */}
            {/* Total Width Arrow (14.5m) */}
            <line x1="0" y1="27.0" x2="14.5" y2="27.0" stroke="#000000" strokeWidth="0.08" strokeDasharray="0.15 0.15" markerStart="url(#thick-arrow)" markerEnd="url(#thick-arrow)" />
            <line x1="0" y1="25.5" x2="0" y2="27.5" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <line x1="14.5" y1="25.5" x2="14.5" y2="27.5" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <rect x="6.3" y="26.6" width="1.9" height="0.8" fill="#ffffff" rx="0.1" />
            <text x="7.25" y="27.2" textAnchor="middle" fontSize="0.45" fontWeight="bold" fill="#000000">14,5m</text>

            {/* Column Spacing Arrow (3.625m) */}
            <line x1="0" y1="-0.4" x2="3.625" y2="-0.4" stroke="#94a3b8" strokeWidth="0.05" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <line x1="3.625" y1="-0.7" x2="3.625" y2="0.2" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <rect x="1.0" y="-0.8" width="1.6" height="0.8" fill="#ffffff" rx="0.1" />
            <text x="1.81" y="-0.25" textAnchor="middle" fontSize="0.4" fontWeight="bold" fill="#64748b">3,625m</text>

            {/* Top Section Height Arrow (6m) */}
            <line x1="-0.8" y1="0" x2="-0.8" y2="6.0" stroke="#94a3b8" strokeWidth="0.05" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <line x1="-1.1" y1="6.0" x2="0.1" y2="6.0" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <rect x="-1.2" y="2.5" width="0.8" height="1.0" fill="#ffffff" rx="0.1" />
            <text x="-0.8" y="3.1" textAnchor="middle" fontSize="0.45" transform="rotate(-90 -0.8 3.0)" fontWeight="bold" fill="#64748b">6m</text>

            {/* Middle Section Height Arrow (18m) */}
            <line x1="15.3" y1="6.0" x2="15.3" y2="25.5" stroke="#94a3b8" strokeWidth="0.05" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <line x1="14.4" y1="25.5" x2="15.6" y2="25.5" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <rect x="14.9" y="15.0" width="0.8" height="1.6" fill="#ffffff" rx="0.1" />
            <text x="15.3" y="16.0" textAnchor="middle" fontSize="0.45" transform="rotate(90 15.3 15.8)" fontWeight="bold" fill="#64748b">18m</text>

            {/* Bottom Section Height Arrow (3m) */}
            <line x1="-0.8" y1="22.5" x2="-0.8" y2="25.5" stroke="#94a3b8" strokeWidth="0.05" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <line x1="-1.1" y1="25.5" x2="0.1" y2="25.5" stroke="#cbd5e1" strokeWidth="0.04" strokeDasharray="0.08 0.08" />
            <rect x="-1.2" y="23.5" width="0.8" height="1.0" fill="#ffffff" rx="0.1" />
            <text x="-0.8" y="24.1" textAnchor="middle" fontSize="0.4" transform="rotate(-90 -0.8 24.0)" fontWeight="bold" fill="#64748b">3m</text>

            {/* Aisle Dimension Arrows */}
            {/* A-Wall (2.75m) */}
            <line x1="0" y1="12.0" x2="2.75" y2="12.0" stroke="#94a3b8" strokeWidth="0.04" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <text x="1.375" y="11.7" textAnchor="middle" fontSize="0.32" fontWeight="bold" fill="#64748b">2,75 m</text>

            {/* B-C (2.75m) */}
            <line x1="5.15" y1="12.0" x2="7.9" y2="12.0" stroke="#94a3b8" strokeWidth="0.04" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <text x="6.525" y="11.7" textAnchor="middle" fontSize="0.32" fontWeight="bold" fill="#64748b">2,75 m</text>

            {/* D-E (2.75m) */}
            <line x1="10.3" y1="12.0" x2="13.05" y2="12.0" stroke="#94a3b8" strokeWidth="0.04" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <text x="11.675" y="11.7" textAnchor="middle" fontSize="0.32" fontWeight="bold" fill="#64748b">2,75 m</text>


            {/* Charging Station width indicator */}
            <line x1="0" y1="24.3" x2="3.0" y2="24.3" stroke="#94a3b8" strokeWidth="0.04" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <rect x="1.1" y="24.0" width="0.8" height="0.4" fill="#f8fafc" />
            <text x="1.5" y="24.4" textAnchor="middle" fontSize="0.3" fontWeight="bold" fill="#64748b">3m</text>
          </svg>

          {/* ─── LIVE FLOATING HOVER CARD ──────────────────────────── */}
          {hoveredCell && (
            <div 
              className="absolute z-30 pointer-events-none bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/50 text-xs w-64 backdrop-blur-sm transition-all duration-75"
              style={{ left: `${hoveredCell.x}px`, top: `${hoveredCell.y}px` }}
            >
              <div className="flex justify-between items-center border-b border-slate-700/80 pb-1.5 mb-1.5">
                <span className="font-bold flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  {(() => {
                    const { rack } = getCellData(hoveredCell.rackCode, hoveredCell.rowNumber);
                    return rack ? rack.rackName : (hoveredCell.rackCode === "FLOOR" ? "Floor Position" : `Rack ${hoveredCell.rackCode}`);
                  })()} - Row {String(getDisplayRowNumber(hoveredCell.rackCode, hoveredCell.rowNumber)).padStart(2, '0')}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  {hoveredCell.positions.length} Lvl
                </span>
              </div>
              
              <div className="space-y-1.5">
                <p className="text-slate-400 font-semibold flex justify-between">
                  <span>Occupancy:</span>
                  <span className={hoveredCell.positions.filter(p => p.isOccupied).length === hoveredCell.positions.length ? "text-rose-400" : "text-emerald-400"}>
                    {hoveredCell.positions.filter(p => p.isOccupied).length} / {hoveredCell.positions.length} Occupied
                  </span>
                </p>
                
                {hoveredCell.positions.some(p => p.isOccupied) ? (
                  <div className="border-t border-slate-800 pt-1.5 mt-1 space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Products Stored:</p>
                    {hoveredCell.positions.filter(p => p.isOccupied).map(pos => {
                      const { rack } = getCellData(hoveredCell.rackCode, hoveredCell.rowNumber);
                      return (
                        <div key={pos.id} className="bg-slate-800/50 p-1.5 rounded border border-slate-800/80 space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">{getLevelName(rack, pos.levelNumber)}</p>
                          {pos.stockLedgers.map((sl: any) => (
                            <div key={sl.id} className="border-t border-slate-700/50 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">
                              <p className="font-semibold text-slate-200 line-clamp-1">{sl.product?.productName}</p>
                              <p className="text-[10px] text-slate-400 font-mono flex justify-between">
                                <span>Batch: {sl.batchNumber || "—"}</span>
                                <span>Qty: {sl.quantity} pcs</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] italic text-slate-500 text-center py-1">Empty Shelf Space</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ─── SPECIFICATIONS SUMMARY PANEL (FROM PHOTO) ──────────── */}
      <div className="mt-8 bg-white border rounded-2xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-500" />
          Warehouse Layout Specifications
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          
          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-700 border-b pb-1">Description</h5>
            <ul className="space-y-1.5 text-xs font-medium text-slate-600">
              <li className="flex flex-col">
                <span className="font-semibold">• 1 Green colour equivalent to :</span>
                <span className="pl-3">4 Layer rack (Row A,B,C,D,E)</span>
                <span className="pl-3">(Row E = 72PP),</span>
                <span className="pl-3">(Row C dan D = 112PP),</span>
                <span className="pl-3">(Row A dan B = 112PP)</span>
              </li>
              <li className="flex justify-between mt-2">
                <span className="font-semibold">• 1 Red colour equivalent to :</span>
                <span className="text-slate-800">1 Layer rack</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-700 border-b pb-1">Total pallet position</h5>
            <ul className="space-y-1.5 text-xs font-medium text-slate-600">
              <li className="flex justify-between">
                <span className="font-semibold">• Green colour :</span>
                <span className="font-bold text-slate-800">72 x 4 = 288 PP</span>
              </li>
              <li className="flex justify-between">
                <span className="font-semibold">• Red colour :</span>
                <span className="font-bold text-slate-800">32 PP</span>
              </li>
              <li className="flex justify-between border-t pt-1.5 mt-2">
                <span className="font-bold text-slate-800">• Total =</span>
                <span className="font-bold text-slate-800">352 PP</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h5 className="font-bold text-slate-700 border-b pb-1">Pallet position Details</h5>
            <ul className="space-y-1.5 text-xs font-medium text-slate-600">
              <li className="flex justify-between">
                <span className="font-semibold">• Length :</span>
                <span className="font-semibold text-slate-800">1m</span>
              </li>
              <li className="flex justify-between">
                <span className="font-semibold">• Width :</span>
                <span className="font-semibold text-slate-800">1,2m</span>
              </li>
              <li className="flex justify-between">
                <span className="font-semibold">• Height :</span>
                <span className="font-semibold text-slate-800">1m</span>
              </li>
              <li className="flex justify-between">
                <span className="font-semibold">• Weight :</span>
                <span className="font-semibold text-slate-800">480-700Kg</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* ─── DETAIL LEVEL STACK DIALOG ───────────────────────────── */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => {
        if (!open) {
          setSelectedCell(null);
          setIsEditing(false);
        }
      }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="border-b pb-4 mb-4 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-start sm:items-center gap-2.5 text-xl sm:text-2xl text-slate-800 w-full pr-8">
              <Layers className="w-6 h-6 text-indigo-600 shrink-0 mt-1 sm:mt-0" />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2">
                <span className="truncate">
                  {selectedCell && (
                    <>
                      {getCellData(selectedCell.rackCode, selectedCell.rowNumber).rack?.rackName || (selectedCell.rackCode === "FLOOR" ? "Floor Storage" : `Rack ${selectedCell.rackCode}`)} - Row {String(getDisplayRowNumber(selectedCell.rackCode, selectedCell.rowNumber)).padStart(2, '0')}
                    </>
                  )}
                </span>
                {selectedCell && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 sm:py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors sm:ml-4 shrink-0 w-full sm:w-auto"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit Names
                  </button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCell && (
            isEditing ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="text-sm font-bold text-slate-700">Edit Names & Numbering</h3>
                  <span className="text-xs text-slate-400 font-mono">Row: {String(getDisplayRowNumber(selectedCell.rackCode, selectedCell.rowNumber)).padStart(2, '0')}</span>
                </div>

                {editError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {editError}
                  </div>
                )}

                {/* Rack Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Rack Display Name
                  </label>
                  <input
                    type="text"
                    value={editRackName}
                    onChange={(e) => setEditRackName(e.target.value)}
                    placeholder="e.g. Rack A"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold"
                  />
                </div>

                {/* Position Codes */}
                <div className="space-y-3.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide border-b pb-1">
                    Pallet Position Numbering (Code)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[...selectedCell.positions]
                      .sort((a, b) => b.levelNumber - a.levelNumber)
                      .map((pos) => {
                        const levelName = getLevelName(getCellData(selectedCell.rackCode, selectedCell.rowNumber).rack, pos.levelNumber);
                        return (
                          <div key={pos.id} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              {levelName}
                            </label>
                            <input
                              type="text"
                              value={editPositionCodes[pos.id] || ""}
                              onChange={(e) =>
                                setEditPositionCodes((prev) => ({
                                  ...prev,
                                  [pos.id]: e.target.value,
                                }))
                              }
                              placeholder="Position Code"
                              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-mono"
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSavingEdit}
                    className="flex-1 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-75"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-medium text-slate-500">
                  Physical stack layout representing shelf levels (Level 4 at top down to Level 1 at floor).
                </p>

                {/* Stack View */}
                <div className="flex flex-col gap-3">
                  {/* Clone and reverse levels so Level 4 (highest) is rendered at the top */}
                  {[...selectedCell.positions]
                    .sort((a, b) => b.levelNumber - a.levelNumber)
                    .map((pos) => {
                      const matched = search && (
                        pos.positionCode.toLowerCase().includes(search.toLowerCase()) || 
                        pos.stockLedgers.some((s: any) => 
                          s.product.productCode.toLowerCase().includes(search.toLowerCase()) || 
                          s.product.productName.toLowerCase().includes(search.toLowerCase()) ||
                          s.batchNumber?.toLowerCase().includes(search.toLowerCase())
                        )
                      );
                      
                      const currentRack = getCellData(selectedCell.rackCode, selectedCell.rowNumber).rack;
                      const levelName = getLevelName(currentRack, pos.levelNumber);
                      
                      return (
                        <div 
                          key={pos.id} 
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${
                            pos.isOccupied 
                              ? matched ? 'border-amber-400 bg-amber-50/50 shadow-sm' : 'border-slate-200 bg-slate-50' 
                              : matched ? 'border-amber-400 bg-amber-50/50 shadow-sm' : 'border-dashed border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-wrap gap-2 justify-between items-center border-b pb-1.5 border-slate-200/50">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded shadow-sm">
                                {pos.positionCode}
                              </span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              pos.isOccupied ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {pos.isOccupied ? 'Occupied' : 'Empty'}
                            </span>
                          </div>
                          
                          {pos.isOccupied && pos.stockLedgers.length > 0 ? (
                            <div className="space-y-3">
                              {pos.stockLedgers.map((sl: any, slIdx: number) => (
                                <div key={sl.id} className={`flex flex-col gap-2 ${slIdx > 0 ? 'border-t pt-3 border-slate-200/60' : ''}`}>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Info</p>
                                      <p className="font-bold text-slate-800 leading-tight">{sl.product.productName}</p>
                                      <p className="text-[10px] font-mono text-slate-500">{sl.product.productCode}</p>
                                    </div>
                                    
                                    <div className="space-y-1 bg-white p-2.5 rounded-xl border flex flex-col justify-between">
                                      <div className="flex justify-between">
                                        <span className="font-medium text-slate-500">Qty:</span>
                                        <span className="font-extrabold text-slate-800">{sl.quantity} pcs</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="font-medium text-slate-500">Volume:</span>
                                        <span className="font-bold text-slate-600">
                                          {(sl.quantity * (sl.product?.sizeLiter || 0)).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} L
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-t pt-1 mt-1 text-[10px]">
                                        <span className="text-slate-400">Batch:</span>
                                        <span className="font-semibold text-slate-600">{sl.batchNumber || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartMove(sl, pos)}
                                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all w-full mt-1"
                                    >
                                      <Move className="w-3.5 h-3.5" />
                                      Move Item
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-slate-400 py-3 text-xs italic font-medium">
                              No pallet stored on this shelf level
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* ─── MOVE ITEM DIALOG ────────────────────────────────────── */}
      <Dialog open={!!movingItem} onOpenChange={(open) => {
        if (!open) setMovingItem(null);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="flex items-center gap-2.5 text-xl text-slate-800 font-bold">
              <Move className="w-5 h-5 text-indigo-600" />
              Move Stock Item
            </DialogTitle>
          </DialogHeader>

          {movingItem && (
            <div className="space-y-4">
              {/* Item Info Box */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</h4>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{movingItem.ledger.product.productName}</p>
                  <p className="text-[10px] font-mono text-slate-500">{movingItem.ledger.product.productCode}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2.5 border-slate-200/50">
                  <div>
                    <span className="text-slate-400 font-medium">Batch Number:</span>
                    <p className="font-semibold text-slate-700">{movingItem.ledger.batchNumber || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Current Location:</span>
                    <p className="font-bold text-indigo-600">{movingItem.currentPosition.positionCode}</p>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 font-medium">Total Qty:</span>
                    <p className="font-semibold text-slate-700">{movingItem.ledger.quantity} pcs</p>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 font-medium">Available (Unreserved):</span>
                    <p className="font-bold text-emerald-600">
                      {movingItem.ledger.quantity - (movingItem.ledger.reservedQty || 0)} pcs
                    </p>
                  </div>
                </div>
              </div>

              {/* Quantity to Move */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Quantity to Move (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  max={movingItem.ledger.quantity}
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  {Number(moveQty) === movingItem.ledger.quantity ? (
                    <span className="text-indigo-600 font-semibold">Full move:</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Partial move:</span>
                  )}{" "}
                  This will move {moveQty || 0} pcs. 
                  {Number(moveQty) < movingItem.ledger.quantity && (
                    <span> Remaining {movingItem.ledger.quantity - Number(moveQty)} pcs will stay.</span>
                  )}
                </p>
              </div>

              {/* Move Destination Filters */}
              <div className="space-y-3.5 border-t pt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Select Target Position
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  {/* Select Rack */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rack</label>
                    <select
                      value={selectedMoveRack}
                      onChange={(e) => {
                        setSelectedMoveRack(e.target.value);
                        setSelectedMoveRow("");
                        setSelectedMoveLevel("");
                        setSelectedTargetPositionId("");
                      }}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
                    >
                      <option value="">All Racks</option>
                      {racks.map(r => (
                        <option key={r.id} value={r.rackCode}>{r.rackCode}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Row */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Row</label>
                    <select
                      value={selectedMoveRow}
                      onChange={(e) => {
                        setSelectedMoveRow(e.target.value);
                        setSelectedTargetPositionId("");
                      }}
                      disabled={!selectedMoveRack}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 disabled:opacity-50"
                    >
                      <option value="">All Rows</option>
                      {moveRowOptions.map(displayRow => (
                        <option key={displayRow} value={displayRow}>
                          {String(displayRow).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Level */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</label>
                    <select
                      value={selectedMoveLevel}
                      onChange={(e) => {
                        setSelectedMoveLevel(e.target.value);
                        setSelectedTargetPositionId("");
                      }}
                      disabled={!selectedMoveRack}
                      className="w-full border rounded-lg px-2 py-1.5 text-xs bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 disabled:opacity-50"
                    >
                      <option value="">All Levels</option>
                      {moveLevelOptions.map(levelNum => {
                        const levelStr = String(levelNum).padStart(2, "0");
                        return (
                          <option key={levelNum} value={levelNum}>
                            {levelStr}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Direct Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search target position code..."
                    value={moveSearchQuery}
                    onChange={(e) => {
                      setMoveSearchQuery(e.target.value);
                      setSelectedTargetPositionId("");
                    }}
                    className="w-full pl-8 pr-3 py-2 border rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Target Selection List */}
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="bg-slate-100/60 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                    <span>Position Code</span>
                    <span>Status / Action</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredTargetPositions.length > 0 ? (
                      filteredTargetPositions.slice(0, 15).map((pos) => {
                        const isSelected = selectedTargetPositionId === pos.id;
                        return (
                          <div
                            key={pos.id}
                            onClick={() => setSelectedTargetPositionId(pos.id)}
                            className={`px-3 py-2.5 flex justify-between items-center cursor-pointer transition-all hover:bg-slate-100 ${
                              isSelected ? "bg-indigo-50/70 border-l-4 border-indigo-600 hover:bg-indigo-50" : ""
                            }`}
                          >
                            <span className="font-mono text-xs font-bold text-slate-700">{pos.positionCode}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                pos.isOccupied ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                              }`}>
                                {pos.isOccupied ? "Occupied" : "Empty"}
                              </span>
                              <div className={`w-3.5 h-3.5 border-2 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs italic text-slate-400 font-medium">
                        No positions match filter criteria
                      </div>
                    )}
                    {filteredTargetPositions.length > 15 && (
                      <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 border-t font-semibold">
                        Showing top 15 results. Refine filters to see more.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {moveError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {moveError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setMovingItem(null)}
                  disabled={isMoving}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Undo className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMove}
                  disabled={isMoving || !selectedTargetPositionId || !moveQty}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Moving...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Confirm Move
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
