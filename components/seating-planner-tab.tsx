'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { FileDown, ImageDown, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

import type { RsvpRecord } from '@/types/rsvp';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Constants ───────────────────────────────────────────────

const TABLE_CAPACITY = 10;
const TABLE_WIDTH = 360;
const TABLE_HEIGHT = 360;
const TABLE_RADIUS = 158;
const TABLE_CENTER = 180;
const SEAT_SIZE = 68;
const TABLE_GAP = 56;
const CELL = TABLE_WIDTH + TABLE_GAP;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.8;
const DEFAULT_ZOOM = MIN_ZOOM;
/** 按鈕縮放步進：程式庫 smooth 模式下為比例 ×1.01 / ÷1.01 */
const ZOOM_BUTTON_STEP = Math.log(1.01);
/** 滑輪／觸控板捏合（smooth）：增量為 smoothStep × |deltaY|，0.01 約對應顯示 +1%／單位 delta */
const WHEEL_ZOOM_SMOOTH_STEP = 0.01;
const FIXED_CANVAS_WIDTH = 3900;
const FIXED_CANVAS_HEIGHT = 1800;
/** 畫布外圈留白（px），放大平移時邊界仍保留可視邊距，避免內容貼死視窗 */
const CANVAS_PAN_GUTTER = 96;
const SEATING_LAYOUT_STORAGE_KEY = 'wedding-rsvp-seating-layout';

/** 座位格內儲存「賓客＋同行第幾位」，與可拖曳項 id 一致；舊資料僅存 guestId */
const SEAT_CELL_SEP = '\u001f';

function makeSeatSlotToken(guestId: string, slotIndex: number): string {
  return `guest-slot${SEAT_CELL_SEP}${guestId}${SEAT_CELL_SEP}${String(slotIndex)}`;
}

function tryParseSeatSlotToken(token: string): { guestId: string; slotIndex: number } | null {
  const parts = token.split(SEAT_CELL_SEP);
  if (parts.length !== 3 || parts[0] !== 'guest-slot') return null;
  const slotIndex = parseInt(parts[2]!, 10);
  if (!Number.isFinite(slotIndex) || slotIndex < 0) return null;
  return { guestId: parts[1]!, slotIndex };
}

function parseSeatCell(token: string): { guestId: string; slotIndex: number } {
  const parsed = tryParseSeatSlotToken(token);
  if (parsed) return parsed;
  return { guestId: token, slotIndex: 0 };
}

function partySeatCount(r: RsvpRecord): number {
  if (!r.attending) return 0;
  const n = Math.floor(Number(r.guestCount));
  if (Number.isFinite(n) && n >= 1) return n;
  return 1;
}

// ─── Types ───────────────────────────────────────────────────

type TablePosition = {
  x: number;
  y: number;
};

type SeatingPlannerTabProps = {
  records: RsvpRecord[];
  filteredGuestIds?: string[];
  filtersPanel?: ReactNode;
  onSave: (
    assignments: Array<{ id: string; seatOrder: number; seatPosition: string }>,
    seatingLayout: { tableCount: number; tablePositions: TablePosition[]; tableNames: string[] },
  ) => Promise<void>;
};

type GuestInfo = {
  id: string;
  name: string;
};

// ─── Preset table layout matching venue floor plan ───────────
// Layout: left block (13) + VIP centre top (1) + right block (14) = 28 tables
//
//  Left block        VIP        Right block
//  O O O              O        O O O O
//  O O O O                    O O O O
//      O O O                  O O O O
//      O O O                  O O O O

const PRESET_POSITIONS: TablePosition[] = [
  // VIP / 主桌 (top centre)
  { x: 4 * CELL, y: 0 },

  // Left block – Row 0
  { x: 0 * CELL, y: 0 * CELL },
  { x: 1 * CELL, y: 0 * CELL },
  { x: 2 * CELL, y: 0 * CELL },
  // Left block – Row 1
  { x: 0 * CELL, y: 1 * CELL },
  { x: 1 * CELL, y: 1 * CELL },
  { x: 2 * CELL, y: 1 * CELL },
  { x: 3 * CELL, y: 1 * CELL },
  // Left block – Row 2
  { x: 1 * CELL, y: 2 * CELL },
  { x: 2 * CELL, y: 2 * CELL },
  { x: 3 * CELL, y: 2 * CELL },
  // Left block – Row 3
  { x: 1 * CELL, y: 3 * CELL },
  { x: 2 * CELL, y: 3 * CELL },
  { x: 3 * CELL, y: 3 * CELL },

  // Right block – Row 0
  { x: 7 * CELL, y: 3 * CELL },
  { x: 6 * CELL, y: 0 * CELL },
  { x: 7 * CELL, y: 0 * CELL },
  { x: 8 * CELL, y: 0 * CELL },
  // Right block – Row 1
  { x: 5 * CELL, y: 1 * CELL },
  { x: 6 * CELL, y: 1 * CELL },
  { x: 7 * CELL, y: 1 * CELL },
  { x: 8 * CELL, y: 1 * CELL },
  // Right block – Row 2
  { x: 5 * CELL, y: 2 * CELL },
  { x: 6 * CELL, y: 2 * CELL },
  { x: 7 * CELL, y: 2 * CELL },
  { x: 8 * CELL, y: 2 * CELL },
  // Right block – Row 3（28 桌場地：此列兩桌）
  { x: 5 * CELL, y: 3 * CELL },
  { x: 6 * CELL, y: 3 * CELL },
];

/** 場地桌次固定 28，與 PRESET_POSITIONS 長度一致 */
const FIXED_TABLE_COUNT = PRESET_POSITIONS.length;

// ─── Utility functions ───────────────────────────────────────

function clampTablePosition(position: TablePosition): TablePosition {
  return {
    x: Math.max(0, Math.min(position.x, FIXED_CANVAS_WIDTH - TABLE_WIDTH)),
    y: Math.max(0, Math.min(position.y, FIXED_CANVAS_HEIGHT - TABLE_HEIGHT)),
  };
}

function getDefaultTablePosition(tableIndex: number): TablePosition {
  if (tableIndex < PRESET_POSITIONS.length) {
    return PRESET_POSITIONS[tableIndex];
  }
  const overflowIndex = tableIndex - PRESET_POSITIONS.length;
  const col = overflowIndex % 9;
  const row = Math.floor(overflowIndex / 9) + 4;
  return { x: col * CELL, y: row * CELL };
}

function resizeTablePositions(positions: TablePosition[], tableCount: number): TablePosition[] {
  if (positions.length === tableCount) return positions;
  if (positions.length > tableCount) return positions.slice(0, tableCount);
  return [
    ...positions,
    ...Array.from({ length: tableCount - positions.length }, (_, i) =>
      getDefaultTablePosition(positions.length + i),
    ),
  ];
}

function resizeAssignments(assignments: Array<string | null>, totalSeats: number) {
  if (assignments.length === totalSeats) return assignments;
  if (assignments.length > totalSeats) return assignments.slice(0, totalSeats);
  return [...assignments, ...Array.from({ length: totalSeats - assignments.length }, () => null)];
}

function defaultTableNames(): string[] {
  return Array.from({ length: FIXED_TABLE_COUNT }, (_, i) => `第 ${i + 1} 桌`);
}

function resizeTableNames(names: string[], tableCount: number): string[] {
  const defaults = Array.from({ length: tableCount }, (_, i) => `第 ${i + 1} 桌`);
  if (names.length === tableCount) {
    return names.map((n, i) => {
      const t = typeof n === 'string' ? n.trim() : '';
      return t.length > 0 ? t.slice(0, 40) : defaults[i]!;
    });
  }
  if (names.length > tableCount) {
    return resizeTableNames(names.slice(0, tableCount), tableCount);
  }
  return [
    ...names.map((n, i) => {
      const t = typeof n === 'string' ? n.trim() : '';
      return t.length > 0 ? t.slice(0, 40) : defaults[i]!;
    }),
    ...defaults.slice(names.length),
  ];
}

function getSavedTableNames(records: RsvpRecord[]): string[] {
  const source = records.find(
    (r) => Array.isArray(r.seatingTableNames) && r.seatingTableNames.length > 0,
  )?.seatingTableNames;
  if (!source) return defaultTableNames();
  return resizeTableNames(source as string[], FIXED_TABLE_COUNT);
}

function normalizeTableNamesForSave(names: string[]): string[] {
  return resizeTableNames(names, FIXED_TABLE_COUNT);
}

function getSavedSeatAssignments(records: RsvpRecord[]) {
  const seats = Array.from<string | null>({
    length: FIXED_TABLE_COUNT * TABLE_CAPACITY,
  }).fill(null);

  records.forEach((r) => {
    if (!r.attending) return;
    const slots = r.seatSlots?.length
      ? [...r.seatSlots].sort((a, b) => a.seatOrder - b.seatOrder)
      : r.seatAssigned && typeof r.seatOrder === 'number'
        ? [{ seatOrder: r.seatOrder, seatPosition: r.seatPosition ?? '' }]
        : [];
    slots.forEach((slot, slotIdx) => {
      const idx = slot.seatOrder - 1;
      if (idx < 0 || idx >= seats.length || seats[idx] !== null) return;
      seats[idx] = makeSeatSlotToken(r.id, slotIdx);
    });
  });

  return seats;
}

function getSavedTableLayout(records: RsvpRecord[]) {
  const sourcePositions = records.find((r) => Array.isArray(r.seatingTablePositions))
    ?.seatingTablePositions;
  const safePositions = (sourcePositions ?? []).flatMap((p) => {
    if (
      typeof p.x !== 'number' ||
      !Number.isFinite(p.x) ||
      typeof p.y !== 'number' ||
      !Number.isFinite(p.y)
    )
      return [];
    return [clampTablePosition({ x: p.x, y: p.y })];
  });

  return {
    tableCount: FIXED_TABLE_COUNT,
    tablePositions: resizeTablePositions(safePositions, FIXED_TABLE_COUNT),
  };
}

function getLocalStoredTableLayout() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SEATING_LAYOUT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { tablePositions?: unknown; tableNames?: unknown };
    if (!Array.isArray(parsed.tablePositions)) return null;

    let tableNames: string[] | undefined;
    if (Array.isArray(parsed.tableNames)) {
      const rawNames = parsed.tableNames.flatMap((item: unknown) => {
        if (typeof item !== 'string') return [];
        const t = item.trim();
        return t.length > 0 ? [t.slice(0, 40)] : [];
      });
      if (rawNames.length > 0) {
        tableNames = resizeTableNames(rawNames, FIXED_TABLE_COUNT);
      }
    }

    const safePositions = parsed.tablePositions.flatMap((p: unknown) => {
      if (typeof p !== 'object' || p === null || !('x' in p) || !('y' in p)) return [];
      const c = p as { x: unknown; y: unknown };
      if (
        typeof c.x !== 'number' ||
        !Number.isFinite(c.x) ||
        typeof c.y !== 'number' ||
        !Number.isFinite(c.y)
      )
        return [];
      return [clampTablePosition({ x: c.x, y: c.y })];
    });

    return {
      tablePositions: resizeTablePositions(safePositions, FIXED_TABLE_COUNT),
      tableNames,
    };
  } catch {
    return null;
  }
}

function saveTableLayoutToLocalStorage(
  tableCount: number,
  tablePositions: TablePosition[],
  tableNames: string[],
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SEATING_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        tableCount,
        tablePositions: resizeTablePositions(tablePositions, tableCount).map(clampTablePosition),
        tableNames: normalizeTableNamesForSave(tableNames),
      }),
    );
  } catch {
    // Ignore local storage failures
  }
}

// ─── Sub‑components ──────────────────────────────────────────

function DraggableGuestSlot({ dragId, label }: { dragId: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { label },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 select-none active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {label}
    </div>
  );
}

function DroppableSeat({
  seatIndex,
  left,
  top,
  occupied,
  children,
  isAnyDragging,
}: {
  seatIndex: number;
  left: number;
  top: number;
  occupied: boolean;
  children: ReactNode;
  isAnyDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `seat-${seatIndex}`,
    disabled: occupied,
  });

  const highlight = isOver && !occupied;

  return (
    <div
      ref={setNodeRef}
      className={`absolute flex h-[68px] w-[68px] select-none flex-col items-center justify-center rounded-full border text-center text-[11px] transition-shadow ${
        occupied
          ? 'border-rose-300 bg-rose-100 text-stone-700'
          : highlight
            ? 'border-rose-400 bg-rose-100/60 ring-2 ring-rose-300 text-stone-600'
            : isAnyDragging && !occupied
              ? 'border-dashed border-rose-300 bg-rose-50/50 text-stone-400'
              : 'border-dashed border-stone-300 bg-white text-stone-400'
      }`}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function SeatingPlannerTab({
  records,
  filteredGuestIds,
  filtersPanel,
  onSave,
}: SeatingPlannerTabProps) {
  // ── Derived initial data ──

  const initialSavedAssignments = useMemo(() => getSavedSeatAssignments(records), [records]);
  const initialSavedLayout = useMemo(() => getSavedTableLayout(records), [records]);
  const attendingGuestMap = useMemo(() => {
    const map = new Map<string, GuestInfo>();
    for (const r of records) {
      if (r.attending) map.set(r.id, { id: r.id, name: r.name });
    }
    return map;
  }, [records]);
  const filteredGuestIdSet = useMemo(
    () => (filteredGuestIds ? new Set(filteredGuestIds) : null),
    [filteredGuestIds],
  );

  // ── State ──

  const [tablePositions, setTablePositions] = useState<TablePosition[]>(
    () => initialSavedLayout.tablePositions,
  );
  const [tableNames, setTableNames] = useState<string[]>(() => getSavedTableNames(records));
  const [lastSavedTableNames, setLastSavedTableNames] = useState<string[]>(() =>
    getSavedTableNames(records),
  );
  const [seatAssignments, setSeatAssignments] = useState<Array<string | null>>(
    () => initialSavedAssignments,
  );
  const [lastSavedSeatAssignments, setLastSavedSeatAssignments] = useState<Array<string | null>>(
    () => initialSavedAssignments,
  );
  const [renameTableIndex, setRenameTableIndex] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(DEFAULT_ZOOM);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [isCanvasPointerDown, setIsCanvasPointerDown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Refs ──

  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const exportCanvasRef = useRef<HTMLDivElement>(null);

  // ── dnd-kit sensors ──

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Effects ──

  const hasUnsavedTableNameChanges = useMemo(
    () => tableNames.some((n, i) => n !== lastSavedTableNames[i]),
    [lastSavedTableNames, tableNames],
  );

  useEffect(() => {
    if (hasUnsavedTableNameChanges) return;
    const next = getSavedTableNames(records);
    const hasServerNames = records.some(
      (r) => Array.isArray(r.seatingTableNames) && r.seatingTableNames.length > 0,
    );
    if (!hasServerNames) return;
    setTableNames(next);
    setLastSavedTableNames(next);
  }, [hasUnsavedTableNameChanges, records]);

  useEffect(() => {
    const hasServerLayout = records.some(
      (r) =>
        (typeof r.seatingTableCount === 'number' && Number.isFinite(r.seatingTableCount)) ||
        (Array.isArray(r.seatingTablePositions) && r.seatingTablePositions.length > 0),
    );
    if (hasServerLayout) return;

    const localLayout = getLocalStoredTableLayout();
    if (localLayout) {
      setTablePositions(localLayout.tablePositions);
      if (localLayout.tableNames) {
        setTableNames(localLayout.tableNames);
        setLastSavedTableNames(localLayout.tableNames);
      }
      return;
    }

    setTablePositions(resizeTablePositions([...PRESET_POSITIONS], FIXED_TABLE_COUNT));
    const defaults = defaultTableNames();
    setTableNames(defaults);
    setLastSavedTableNames(defaults);
  }, [records]);

  useEffect(() => {
    const validIds = new Set(records.filter((r) => r.attending).map((r) => r.id));
    setSeatAssignments((prev) =>
      prev.map((token) => {
        if (!token) return null;
        const { guestId } = parseSeatCell(token);
        return validIds.has(guestId) ? token : null;
      }),
    );
    setLastSavedSeatAssignments((prev) =>
      prev.map((token) => {
        if (!token) return null;
        const { guestId } = parseSeatCell(token);
        return validIds.has(guestId) ? token : null;
      }),
    );
  }, [records]);

  useEffect(() => {
    if (activeDragLabel) setIsCanvasPointerDown(false);
  }, [activeDragLabel]);

  useEffect(() => {
    if (!isCanvasPointerDown) return;
    const end = () => setIsCanvasPointerDown(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [isCanvasPointerDown]);

  // ── Derived values ──

  const unassignedPartySlots = useMemo(() => {
    const tokensInSeats = new Set(seatAssignments.filter((t): t is string => t !== null));
    const rows: Array<{ dragId: string; label: string }> = [];
    for (const r of records) {
      if (!r.attending) continue;
      const matchFilter = filteredGuestIdSet ? filteredGuestIdSet.has(r.id) : true;
      if (!matchFilter) continue;
      const n = partySeatCount(r);
      for (let i = 0; i < n; i++) {
        const dragId = makeSeatSlotToken(r.id, i);
        if (!tokensInSeats.has(dragId)) {
          rows.push({
            dragId,
            label: n > 1 ? `${r.name}（${i + 1}/${n}）` : r.name,
          });
        }
      }
    }
    return rows;
  }, [records, seatAssignments, filteredGuestIdSet]);

  const seatedCount = seatAssignments.filter((t) => t !== null).length;
  const totalSeats = FIXED_TABLE_COUNT * TABLE_CAPACITY;
  const zoomPercent = Math.round(canvasZoom * 100);

  const handleCanvasWrapperPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (activeDragLabel) return;
      if (e.button !== 0) return;
      const { target } = e;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
      setIsCanvasPointerDown(true);
    },
    [activeDragLabel],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (hasUnsavedTableNameChanges) return true;
    if (seatAssignments.length !== lastSavedSeatAssignments.length) return true;
    return seatAssignments.some((id, i) => id !== lastSavedSeatAssignments[i]);
  }, [hasUnsavedTableNameChanges, lastSavedSeatAssignments, seatAssignments]);

  // ── Handlers ──

  function clearSeat(seatIndex: number) {
    setSeatAssignments((prev) => {
      const next = [...prev];
      next[seatIndex] = null;
      return next;
    });
  }

  function resetSeats() {
    setSeatAssignments(Array.from({ length: totalSeats }, () => null));
  }

  // ── Zoom controls ──

  function handleZoomIn() {
    transformRef.current?.zoomIn(ZOOM_BUTTON_STEP, 200);
  }

  function handleZoomOut() {
    transformRef.current?.zoomOut(ZOOM_BUTTON_STEP, 200);
  }

  /** 以視窗中心為錨點變更縮放（與縮放滑桿一致；匯出時需暫時設為 1 才能正確擷取畫布） */
  function applyScaleKeepingCenter(ref: ReactZoomPanPinchRef, newScale: number, animationTime = 0) {
    const ts = ref.instance.transformState;
    const wrapper = ref.instance.wrapperComponent;
    if (!wrapper) {
      ref.setTransform(ts.positionX, ts.positionY, newScale, animationTime);
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const contentX = (cx - ts.positionX) / ts.scale;
    const contentY = (cy - ts.positionY) / ts.scale;
    ref.setTransform(cx - contentX * newScale, cy - contentY * newScale, newScale, animationTime);
  }

  function handleSliderZoom(newScale: number) {
    const ref = transformRef.current;
    if (!ref) return;
    applyScaleKeepingCenter(ref, newScale, 0);
  }

  const handleTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
      setCanvasZoom(state.scale);
    },
    [],
  );

  // ── dnd-kit handlers ──

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { label?: unknown } | undefined;
    if (typeof data?.label === 'string') {
      setActiveDragLabel(data.label);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over) {
      const overId = String(over.id);
      if (overId.startsWith('seat-')) {
        const seatIndex = parseInt(overId.slice('seat-'.length), 10);
        const token = String(active.id);
        const { guestId } = parseSeatCell(token);
        if (!isNaN(seatIndex) && guestId && attendingGuestMap.has(guestId)) {
          setSeatAssignments((prev) => {
            if (prev[seatIndex] !== null || prev.includes(token)) return prev;
            const next = [...prev];
            next[seatIndex] = token;
            return next;
          });
        }
      }
    }
    setActiveDragLabel(null);
  }

  // ── Save ──

  async function persistSeating(namesForSave: string[]) {
    setIsSaving(true);
    setSaveMessage('');
    setSaveError(false);

    try {
      const normalizedNames = normalizeTableNamesForSave(namesForSave);
      const assignments = seatAssignments.flatMap((cellToken, index) => {
        if (!cellToken) return [];
        const { guestId } = parseSeatCell(cellToken);
        const tableIndex = Math.floor(index / TABLE_CAPACITY);
        const seatNum = (index % TABLE_CAPACITY) + 1;
        const label = normalizedNames[tableIndex] ?? `第 ${tableIndex + 1} 桌`;
        return [
          {
            id: guestId,
            seatOrder: index + 1,
            seatPosition: `${label} - ${seatNum} 號位`,
          },
        ];
      });

      const normalizedPositions = resizeTablePositions(
        tablePositions,
        FIXED_TABLE_COUNT,
      ).map(clampTablePosition);
      await onSave(assignments, {
        tableCount: FIXED_TABLE_COUNT,
        tablePositions: normalizedPositions,
        tableNames: normalizedNames,
      });
      saveTableLayoutToLocalStorage(FIXED_TABLE_COUNT, normalizedPositions, normalizedNames);
      setTableNames(normalizedNames);
      setLastSavedTableNames(normalizedNames);
      setLastSavedSeatAssignments([...seatAssignments]);
      setSaveMessage('座位安排已儲存。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '儲存失敗，請稍後再試。';
      setSaveMessage(msg);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSeats() {
    await persistSeating(tableNames);
  }

  function exportFilenameStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async function captureSeatingLayoutCanvas(): Promise<HTMLCanvasElement> {
    const el = exportCanvasRef.current;
    if (!el) {
      throw new Error('找不到畫布');
    }

    const api = transformRef.current;
    let saved: { positionX: number; positionY: number; scale: number } | null = null;
    if (api) {
      const ts = api.instance.transformState;
      saved = { positionX: ts.positionX, positionY: ts.positionY, scale: ts.scale };
      // resetTransform 會回到 initialScale（MIN_ZOOM 0.25），不是 1，會讓擷取庫算出錯誤畫面
      applyScaleKeepingCenter(api, 1, 0);
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    try {
      const { toCanvas } = await import('html-to-image');
      return await toCanvas(el, {
        pixelRatio: 2,
        backgroundColor: '#fdf2f8',
        cacheBust: true,
        skipAutoScale: true,
        filter: (domNode) => {
          if (!(domNode instanceof HTMLElement)) return true;
          return !domNode.hasAttribute('data-export-ignore');
        },
      });
    } finally {
      if (api && saved) {
        api.setTransform(saved.positionX, saved.positionY, saved.scale, 0);
      }
    }
  }

  async function handleExportSeatingImage() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await captureSeatingLayoutCanvas();
      const stamp = exportFilenameStamp();
      const link = document.createElement('a');
      link.download = `seating-plan-${stamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('已匯出圖片');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '匯出失敗';
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportSeatingPdf() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await captureSeatingLayoutCanvas();
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const props = pdf.getImageProperties(imgData);
      const imgRatio = props.width / props.height;
      const pageRatio = pageW / pageH;
      let w: number;
      let h: number;
      if (imgRatio > pageRatio) {
        w = pageW;
        h = pageW / imgRatio;
      } else {
        h = pageH;
        w = pageH * imgRatio;
      }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(imgData, 'PNG', x, y, w, h);
      const stamp = exportFilenameStamp();
      pdf.save(`seating-plan-${stamp}.pdf`);
      toast.success('已匯出 PDF');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '匯出失敗';
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }

  function openRenameTableDialog(tableIndex: number) {
    setRenameDraft(tableNames[tableIndex] ?? `第 ${tableIndex + 1} 桌`);
    setRenameTableIndex(tableIndex);
  }

  function closeRenameTableDialog() {
    setRenameTableIndex(null);
    setRenameDraft('');
  }

  async function confirmRenameTable() {
    if (renameTableIndex === null) return;
    const tableIndex = renameTableIndex;
    const fallback = `第 ${tableIndex + 1} 桌`;
    const trimmed = renameDraft.trim().slice(0, 40) || fallback;
    const nextNames = tableNames.map((n, i) => (i === tableIndex ? trimmed : n));
    setTableNames(nextNames);
    closeRenameTableDialog();
    await persistSeating(nextNames);
  }

  // ── Render ──

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
        {/* Header */}
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-stone-700'>座位安排（多桌畫布）</p>
            <p className='mt-1 text-sm text-stone-500'>
              先拖拉上方賓客到下方畫布中的桌位；若回覆的參加人數大於 1，清單會出現對應數量的標籤（例如
              姓名（2/3））以便對齊總人數。每桌共 {TABLE_CAPACITY} 位，場地固定 {FIXED_TABLE_COUNT}{' '}
              桌；點畫布上筆形圖示可為該桌命名並立即儲存。可調整畫布縮放。
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              className='rounded-full'
              onClick={() => setResetDialogOpen(true)}
            >
              重置座位
            </Button>
            <Button
              type='button'
              className='rounded-full'
              onClick={() => void handleSaveSeats()}
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? '儲存中...' : '儲存安排'}
            </Button>
          </div>
        </div>

        {saveMessage ? (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-sm ${
              saveError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {saveMessage}
          </p>
        ) : null}

        {/* Guest list */}
        <div className='mt-4 rounded-3xl border border-rose-100 bg-rose-50/40 p-4'>
          {filtersPanel ? <div className='mb-4'>{filtersPanel}</div> : null}

          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-xs font-medium text-stone-600'>會出席賓客清單（可拖拉）</p>
            <p className='text-xs text-stone-500'>
              已安排 {seatedCount} / {totalSeats}（固定 {FIXED_TABLE_COUNT} 桌）
            </p>
          </div>

          {unassignedPartySlots.length === 0 ? (
            <p className='mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-stone-500'>
              所有可安排賓客都已放入座位，或目前沒有出席賓客資料。
            </p>
          ) : (
            <div className='mt-3 flex flex-wrap gap-2'>
              {unassignedPartySlots.map((slot) => (
                <DraggableGuestSlot key={slot.dragId} dragId={slot.dragId} label={slot.label} />
              ))}
            </div>
          )}
        </div>

        {/* Canvas with zoom controls */}
        <div className='mt-6'>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 gap-1.5 rounded-full text-xs'
                onClick={() => void handleExportSeatingImage()}
                disabled={isExporting || !!activeDragLabel}
              >
                <ImageDown aria-hidden='true' className='size-3.5' />
                匯出圖片
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 gap-1.5 rounded-full text-xs'
                onClick={() => void handleExportSeatingPdf()}
                disabled={isExporting || !!activeDragLabel}
              >
                <FileDown aria-hidden='true' className='size-3.5' />
                匯出 PDF
              </Button>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                size='icon'
                variant='outline'
                className='h-7 w-7 rounded-full'
                onClick={handleZoomOut}
                disabled={canvasZoom <= MIN_ZOOM}
              >
                <ZoomOut aria-hidden='true' className='size-3.5' />
                <span className='sr-only'>縮小畫布</span>
              </Button>
              <input
                type='range'
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={canvasZoom}
                onChange={(e) => handleSliderZoom(Number(e.target.value))}
                className='w-28 accent-rose-500'
                aria-label='畫布縮放'
              />
              <Button
                type='button'
                size='icon'
                variant='outline'
                className='h-7 w-7 rounded-full'
                onClick={handleZoomIn}
                disabled={canvasZoom >= MAX_ZOOM}
              >
                <ZoomIn aria-hidden='true' className='size-3.5' />
                <span className='sr-only'>放大畫布</span>
              </Button>
              <span className='min-w-[3.5rem] text-right'>{zoomPercent}%</span>
            </div>
          </div>

          <div
            className='overflow-hidden rounded-3xl border border-rose-100 bg-rose-50/30'
            style={{ height: '60vh', minHeight: 400 }}
          >
            <TransformWrapper
              ref={transformRef}
              initialScale={DEFAULT_ZOOM}
              minScale={MIN_ZOOM}
              maxScale={MAX_ZOOM}
              centerOnInit
              disabled={!!activeDragLabel}
              onTransformed={handleTransformed}
              wheel={{ smoothStep: WHEEL_ZOOM_SMOOTH_STEP }}
              // 預設會在邊界外多給一段可拖曳距離，放開時再動畫對齊，視覺上像回彈
              disablePadding
              alignmentAnimation={{ disabled: true }}
              panning={{ velocityDisabled: true }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: '100%',
                  ...(activeDragLabel
                    ? {}
                    : { cursor: isCanvasPointerDown ? 'grabbing' : 'grab' }),
                }}
                wrapperProps={{ onPointerDown: handleCanvasWrapperPointerDown }}
              >
                <div
                  className='relative bg-rose-50/30'
                  style={{
                    width: FIXED_CANVAS_WIDTH + CANVAS_PAN_GUTTER * 2,
                    height: FIXED_CANVAS_HEIGHT + CANVAS_PAN_GUTTER * 2,
                  }}
                >
                  <div
                    ref={exportCanvasRef}
                    className='relative'
                    style={{
                      position: 'absolute',
                      left: CANVAS_PAN_GUTTER,
                      top: CANVAS_PAN_GUTTER,
                      width: FIXED_CANVAS_WIDTH,
                      height: FIXED_CANVAS_HEIGHT,
                    }}
                  >
                  {Array.from({ length: FIXED_TABLE_COUNT }, (_, tableIndex) => {
                    const tableNumber = tableIndex + 1;
                    const tablePosition = clampTablePosition(
                      tablePositions[tableIndex] ?? getDefaultTablePosition(tableIndex),
                    );

                    return (
                      <div key={tableNumber}>
                        {/* Table circle */}
                        <div
                          className='absolute h-48 w-48 rounded-full border-4 border-rose-200 bg-rose-50 shadow-inner'
                          style={{
                            left: tablePosition.x + TABLE_CENTER - 96,
                            top: tablePosition.y + TABLE_CENTER - 96,
                          }}
                        >
                          <div className='flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center'>
                            <span className='line-clamp-2 text-sm font-semibold text-stone-600'>
                              {tableNames[tableIndex] ?? `第 ${tableNumber} 桌`}
                            </span>
                            <Button
                              type='button'
                              variant='outline'
                              size='icon'
                              data-export-ignore
                              className='h-7 w-7 shrink-0 rounded-full border-rose-200 text-stone-600'
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => openRenameTableDialog(tableIndex)}
                              disabled={isSaving}
                            >
                              <Pencil aria-hidden='true' className='size-3.5' />
                              <span className='sr-only'>編輯桌次名稱</span>
                            </Button>
                          </div>
                        </div>

                        {/* Seats around the table */}
                        {Array.from({ length: TABLE_CAPACITY }, (_, seatOffset) => {
                          const seatIndex = tableIndex * TABLE_CAPACITY + seatOffset;
                          const cellToken = seatAssignments[seatIndex];
                          const angle =
                            (seatOffset / TABLE_CAPACITY) * Math.PI * 2 - Math.PI / 2;
                          const left =
                            tablePosition.x +
                            TABLE_CENTER +
                            TABLE_RADIUS * Math.cos(angle) -
                            SEAT_SIZE / 2;
                          const top =
                            tablePosition.y +
                            TABLE_CENTER +
                            TABLE_RADIUS * Math.sin(angle) -
                            SEAT_SIZE / 2;
                          const parsed = cellToken ? parseSeatCell(cellToken) : null;
                          const guest = parsed
                            ? (attendingGuestMap.get(parsed.guestId) ?? null)
                            : null;
                          const partyRecord = parsed
                            ? records.find((x) => x.id === parsed.guestId)
                            : undefined;
                          const partyN = partyRecord ? partySeatCount(partyRecord) : 1;
                          const seatDisplayName =
                            guest && partyN > 1
                              ? `${guest.name}（${parsed!.slotIndex + 1}/${partyN}）`
                              : guest?.name ?? '';

                          return (
                            <DroppableSeat
                              key={seatIndex}
                              seatIndex={seatIndex}
                              left={left}
                              top={top}
                              occupied={!!guest}
                              isAnyDragging={!!activeDragLabel}
                            >
                              {guest ? (
                                <>
                                  <span className='line-clamp-1 max-w-[52px] font-medium'>
                                    {seatDisplayName}
                                  </span>
                                  <button
                                    type='button'
                                    data-export-ignore
                                    onClick={() => clearSeat(seatIndex)}
                                    className='mt-1 cursor-pointer rounded-full bg-white px-2 py-0.5 text-[10px] text-stone-500 hover:text-rose-600'
                                  >
                                    移除
                                  </button>
                                </>
                              ) : (
                                <span>{seatOffset + 1} 號位</span>
                              )}
                            </DroppableSeat>
                          );
                        })}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      </section>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragLabel ? (
          <div className='rounded-full border border-rose-300 bg-rose-100 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-lg'>
            {activeDragLabel}
          </div>
        ) : null}
      </DragOverlay>

      {/* Rename single table */}
      <Dialog
        open={renameTableIndex !== null}
        onOpenChange={(open) => {
          if (!open) closeRenameTableDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯桌次名稱</DialogTitle>
            <DialogDescription>
              名稱會寫入賓客的「座位位置」欄位（例如：主桌 - 3 號位）。按儲存後會一併更新目前座位與畫布配置。
            </DialogDescription>
          </DialogHeader>
          <div className='py-2'>
            <label htmlFor='rename-table-input' className='sr-only'>
              桌次名稱
            </label>
            <input
              id='rename-table-input'
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={40}
              disabled={isSaving}
              className='w-full rounded-xl border border-rose-200 px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200'
              placeholder='例如：主桌、男方同事'
            />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={closeRenameTableDialog} disabled={isSaving}>
              取消
            </Button>
            <Button type='button' onClick={() => void confirmRenameTable()} disabled={isSaving}>
              {isSaving ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認重置座位</DialogTitle>
            <DialogDescription>
              這會清空目前所有座位安排，且無法復原。是否確定要重置？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setResetDialogOpen(false)}>
              取消
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={() => {
                resetSeats();
                setResetDialogOpen(false);
              }}
            >
              確認重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
