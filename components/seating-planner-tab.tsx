'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Minus, Plus, ZoomIn, ZoomOut } from 'lucide-react';
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
const MAX_TABLE_COUNT = 100;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.8;
const DEFAULT_ZOOM = 0.5;
const FIXED_CANVAS_WIDTH = 3900;
const FIXED_CANVAS_HEIGHT = 1800;
const SEATING_LAYOUT_STORAGE_KEY = 'wedding-rsvp-seating-layout';

// ─── Types ───────────────────────────────────────────────────

type TablePosition = {
  x: number;
  y: number;
};

type DraggingTableState = {
  tableIndex: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
};

type SeatingPlannerTabProps = {
  records: RsvpRecord[];
  filteredGuestIds?: string[];
  filtersPanel?: ReactNode;
  onSave: (
    assignments: Array<{ id: string; seatOrder: number; seatPosition: string }>,
    seatingLayout: { tableCount: number; tablePositions: TablePosition[] },
  ) => Promise<void>;
};

type GuestInfo = {
  id: string;
  name: string;
  side: string;
};

// ─── Preset table layout matching venue floor plan ───────────
// Layout: left block (13) + VIP centre top (1) + right block (16) = 30 tables
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
  { x: 5 * CELL, y: 0 * CELL },
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
  // Right block – Row 3
  { x: 5 * CELL, y: 3 * CELL },
  { x: 6 * CELL, y: 3 * CELL },
  { x: 7 * CELL, y: 3 * CELL },
  { x: 8 * CELL, y: 3 * CELL },
];

const DEFAULT_TABLE_COUNT = PRESET_POSITIONS.length;

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

function getRequiredTableCount(assignments: Array<string | null>) {
  const lastFilled = assignments.reduce((last, id, i) => (id ? i : last), -1);
  return Math.max(1, Math.floor(lastFilled / TABLE_CAPACITY) + 1);
}

function getSavedSeatAssignments(records: RsvpRecord[]) {
  const maxSeatOrder = records.reduce((max, r) => {
    if (!r.attending || !r.seatAssigned || typeof r.seatOrder !== 'number') return max;
    return Math.max(max, r.seatOrder);
  }, 0);
  const tableCount = Math.max(1, Math.ceil(maxSeatOrder / TABLE_CAPACITY));
  const seats = Array.from<string | null>({ length: tableCount * TABLE_CAPACITY }).fill(null);

  records.forEach((r) => {
    if (!r.attending || !r.seatAssigned || typeof r.seatOrder !== 'number') return;
    const idx = r.seatOrder - 1;
    if (idx < 0 || idx >= seats.length || seats[idx] !== null) return;
    seats[idx] = r.id;
  });

  return seats;
}

function getSavedTableLayout(records: RsvpRecord[], fallbackTableCount: number) {
  const savedTableCount = records.reduce((max, r) => {
    if (typeof r.seatingTableCount !== 'number' || !Number.isFinite(r.seatingTableCount)) return max;
    return Math.max(max, Math.floor(r.seatingTableCount));
  }, 0);

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

  const tableCount = Math.max(1, fallbackTableCount, savedTableCount);
  return { tableCount, tablePositions: resizeTablePositions(safePositions, tableCount) };
}

function getLocalStoredTableLayout() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SEATING_LAYOUT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { tableCount?: unknown; tablePositions?: unknown };
    if (typeof parsed.tableCount !== 'number' || !Number.isFinite(parsed.tableCount)) return null;
    if (!Array.isArray(parsed.tablePositions)) return null;

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

    const tableCount = Math.max(1, Math.floor(parsed.tableCount));
    return { tableCount, tablePositions: resizeTablePositions(safePositions, tableCount) };
  } catch {
    return null;
  }
}

function saveTableLayoutToLocalStorage(tableCount: number, tablePositions: TablePosition[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SEATING_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        tableCount,
        tablePositions: resizeTablePositions(tablePositions, tableCount).map(clampTablePosition),
      }),
    );
  } catch {
    // Ignore local storage failures
  }
}

// ─── Sub‑components ──────────────────────────────────────────

function DraggableGuest({ guest }: { guest: GuestInfo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { guestId: guest.id },
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
      {guest.name}
      <span className='ml-1 text-stone-400'>({guest.side === 'groom' ? '男方' : '女方'})</span>
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
  const initialSavedLayout = useMemo(
    () =>
      getSavedTableLayout(
        records,
        Math.max(1, Math.ceil(initialSavedAssignments.length / TABLE_CAPACITY)),
      ),
    [initialSavedAssignments.length, records],
  );
  const attendingGuests = useMemo(
    () =>
      records
        .filter((r) => r.attending)
        .map((r) => ({ id: r.id, name: r.name, side: r.side })),
    [records],
  );
  const attendingGuestMap = useMemo(
    () => new Map(attendingGuests.map((g) => [g.id, g])),
    [attendingGuests],
  );
  const filteredGuestIdSet = useMemo(
    () => (filteredGuestIds ? new Set(filteredGuestIds) : null),
    [filteredGuestIds],
  );

  // ── State ──

  const [tableCount, setTableCount] = useState(() => initialSavedLayout.tableCount);
  const [tablePositions, setTablePositions] = useState<TablePosition[]>(
    () => initialSavedLayout.tablePositions,
  );
  const [draggingTable, setDraggingTable] = useState<DraggingTableState | null>(null);
  const [seatAssignments, setSeatAssignments] = useState<Array<string | null>>(
    () => initialSavedAssignments,
  );
  const [lastSavedSeatAssignments, setLastSavedSeatAssignments] = useState<Array<string | null>>(
    () => initialSavedAssignments,
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(DEFAULT_ZOOM);
  const [activeDragGuestId, setActiveDragGuestId] = useState<string | null>(null);

  // ── Refs ──

  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // ── dnd-kit sensors ──

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Effects ──

  useEffect(() => {
    const hasServerLayout = records.some(
      (r) =>
        (typeof r.seatingTableCount === 'number' && Number.isFinite(r.seatingTableCount)) ||
        (Array.isArray(r.seatingTablePositions) && r.seatingTablePositions.length > 0),
    );
    if (hasServerLayout) return;

    const localLayout = getLocalStoredTableLayout();
    if (localLayout) {
      setTableCount(localLayout.tableCount);
      setTablePositions(localLayout.tablePositions);
      return;
    }

    setTableCount(DEFAULT_TABLE_COUNT);
    setTablePositions([...PRESET_POSITIONS]);
  }, [records]);

  useEffect(() => {
    const validIds = new Set(attendingGuests.map((g) => g.id));
    setSeatAssignments((prev) => prev.map((id) => (id && validIds.has(id) ? id : null)));
    setLastSavedSeatAssignments((prev) => prev.map((id) => (id && validIds.has(id) ? id : null)));
  }, [attendingGuests]);

  useEffect(() => {
    const totalSeats = tableCount * TABLE_CAPACITY;
    setSeatAssignments((prev) => resizeAssignments(prev, totalSeats));
    setLastSavedSeatAssignments((prev) => resizeAssignments(prev, totalSeats));
    setTablePositions((prev) => resizeTablePositions(prev, tableCount));
  }, [tableCount]);

  // ── Table dragging (repositioning on canvas) ──

  useEffect(() => {
    if (!draggingTable) return;
    const cd = draggingTable;

    function onMove(event: MouseEvent) {
      const scale = transformRef.current?.instance.transformState.scale ?? 1;
      const dx = (event.clientX - cd.startClientX) / scale;
      const dy = (event.clientY - cd.startClientY) / scale;
      setTablePositions((prev) =>
        prev.map((pos, i) =>
          i === cd.tableIndex
            ? clampTablePosition({
                x: Math.round(cd.originX + dx),
                y: Math.round(cd.originY + dy),
              })
            : pos,
        ),
      );
    }

    function onUp() {
      setDraggingTable(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingTable]);

  // ── Derived values ──

  const assignedGuestIds = useMemo(
    () => new Set(seatAssignments.filter((id): id is string => id !== null)),
    [seatAssignments],
  );
  const unassignedGuests = useMemo(
    () =>
      attendingGuests.filter((g) => {
        const matchFilter = filteredGuestIdSet ? filteredGuestIdSet.has(g.id) : true;
        return matchFilter && !assignedGuestIds.has(g.id);
      }),
    [assignedGuestIds, attendingGuests, filteredGuestIdSet],
  );

  const seatedCount = assignedGuestIds.size;
  const totalSeats = tableCount * TABLE_CAPACITY;
  const requiredTableCount = useMemo(
    () => getRequiredTableCount(seatAssignments),
    [seatAssignments],
  );
  const zoomPercent = Math.round(canvasZoom * 100);
  const hasUnsavedChanges = useMemo(() => {
    if (seatAssignments.length !== lastSavedSeatAssignments.length) return true;
    return seatAssignments.some((id, i) => id !== lastSavedSeatAssignments[i]);
  }, [lastSavedSeatAssignments, seatAssignments]);
  const isDraggingTable = draggingTable !== null;

  // ── Handlers ──

  function handleTableMouseDown(event: ReactMouseEvent<HTMLDivElement>, tableIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    const pos = tablePositions[tableIndex] ?? getDefaultTablePosition(tableIndex);
    setDraggingTable({
      tableIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: pos.x,
      originY: pos.y,
    });
  }

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

  function updateTableCount(nextCount: number) {
    const normalized = Math.min(MAX_TABLE_COUNT, Math.max(1, Math.floor(nextCount)));
    if (normalized < requiredTableCount) {
      setSaveError(true);
      setSaveMessage(`目前至少需要 ${requiredTableCount} 桌，請先清除後段桌位上的賓客。`);
      return;
    }
    setSaveMessage('');
    setSaveError(false);
    setTableCount(normalized);
  }

  // ── Zoom controls ──

  function handleZoomIn() {
    transformRef.current?.zoomIn(0.2, 200);
  }

  function handleZoomOut() {
    transformRef.current?.zoomOut(0.2, 200);
  }

  function handleSliderZoom(newScale: number) {
    const ref = transformRef.current;
    if (!ref) return;

    const ts = ref.instance.transformState;
    const wrapper = ref.instance.wrapperComponent;
    if (!wrapper) {
      ref.setTransform(ts.positionX, ts.positionY, newScale, 0);
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const contentX = (cx - ts.positionX) / ts.scale;
    const contentY = (cy - ts.positionY) / ts.scale;
    ref.setTransform(cx - contentX * newScale, cy - contentY * newScale, newScale, 0);
  }

  const handleTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
      setCanvasZoom(state.scale);
    },
    [],
  );

  // ── dnd-kit handlers ──

  function handleDragStart(event: DragStartEvent) {
    const rawId = String(event.active.id);
    if (rawId.startsWith('guest-')) {
      setActiveDragGuestId(rawId.slice('guest-'.length));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over) {
      const overId = String(over.id);
      if (overId.startsWith('seat-')) {
        const seatIndex = parseInt(overId.slice('seat-'.length), 10);
        const guestId = String(active.id).slice('guest-'.length);
        if (!isNaN(seatIndex) && guestId && attendingGuestMap.has(guestId)) {
          setSeatAssignments((prev) => {
            if (prev[seatIndex] !== null || prev.includes(guestId)) return prev;
            const next = [...prev];
            next[seatIndex] = guestId;
            return next;
          });
        }
      }
    }
    setActiveDragGuestId(null);
  }

  // ── Save ──

  async function handleSaveSeats() {
    setIsSaving(true);
    setSaveMessage('');
    setSaveError(false);

    try {
      const assignments = seatAssignments.flatMap((guestId, index) =>
        guestId
          ? [
              {
                id: guestId,
                seatOrder: index + 1,
                seatPosition: `第 ${Math.floor(index / TABLE_CAPACITY) + 1} 桌 - ${((index % TABLE_CAPACITY) + 1).toString()} 號位`,
              },
            ]
          : [],
      );

      const normalizedPositions = resizeTablePositions(tablePositions, tableCount).map(
        clampTablePosition,
      );
      await onSave(assignments, { tableCount, tablePositions: normalizedPositions });
      saveTableLayoutToLocalStorage(tableCount, normalizedPositions);
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

  const activeDragGuest = activeDragGuestId ? attendingGuestMap.get(activeDragGuestId) : null;

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
              先拖拉上方賓客到下方畫布中的桌位，每桌共 {TABLE_CAPACITY} 位，可自由調整桌數與縮放。
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
            <div className='flex flex-wrap items-center gap-3 text-xs text-stone-500'>
              <p>
                已安排 {seatedCount} / {totalSeats}
              </p>
              <div className='flex items-center gap-2'>
                <span>桌數</span>
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  className='h-7 w-7 rounded-full'
                  onClick={() => updateTableCount(tableCount - 1)}
                  disabled={tableCount <= requiredTableCount}
                >
                  <Minus aria-hidden='true' className='size-3.5' />
                  <span className='sr-only'>減少桌數</span>
                </Button>
                <input
                  type='number'
                  min={1}
                  max={MAX_TABLE_COUNT}
                  value={tableCount}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) updateTableCount(v);
                  }}
                  className='h-7 w-16 rounded-lg border border-rose-200 bg-white px-2 text-center text-xs text-stone-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200'
                />
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  className='h-7 w-7 rounded-full'
                  onClick={() => updateTableCount(tableCount + 1)}
                  disabled={tableCount >= MAX_TABLE_COUNT}
                >
                  <Plus aria-hidden='true' className='size-3.5' />
                  <span className='sr-only'>增加桌數</span>
                </Button>
              </div>
            </div>
          </div>

          {unassignedGuests.length === 0 ? (
            <p className='mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-stone-500'>
              所有可安排賓客都已放入座位，或目前沒有出席賓客資料。
            </p>
          ) : (
            <div className='mt-3 flex flex-wrap gap-2'>
              {unassignedGuests.map((guest) => (
                <DraggableGuest key={guest.id} guest={guest} />
              ))}
            </div>
          )}
        </div>

        {/* Canvas with zoom controls */}
        <div className='mt-6'>
          <div className='mb-3 flex items-center justify-end gap-2 text-xs text-stone-500'>
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
              disabled={!!activeDragGuestId || isDraggingTable}
              onTransformed={handleTransformed}
              wheel={{ smoothStep: 0.05 }}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
              >
                <div
                  className='relative'
                  style={{ width: FIXED_CANVAS_WIDTH, height: FIXED_CANVAS_HEIGHT }}
                >
                  {Array.from({ length: tableCount }, (_, tableIndex) => {
                    const tableNumber = tableIndex + 1;
                    const tablePosition = clampTablePosition(
                      tablePositions[tableIndex] ?? getDefaultTablePosition(tableIndex),
                    );

                    return (
                      <div key={tableNumber}>
                        {/* Table circle */}
                        <div
                          className={`absolute h-48 w-48 rounded-full border-4 border-rose-200 bg-rose-50 shadow-inner ${
                            isDraggingTable && draggingTable?.tableIndex === tableIndex
                              ? 'cursor-grabbing border-rose-300'
                              : 'cursor-grab'
                          }`}
                          style={{
                            left: tablePosition.x + TABLE_CENTER - 96,
                            top: tablePosition.y + TABLE_CENTER - 96,
                          }}
                          onMouseDown={(e) => handleTableMouseDown(e, tableIndex)}
                        >
                          <div className='flex h-full w-full items-center justify-center text-sm font-semibold text-stone-500'>
                            第 {tableNumber} 桌
                          </div>
                        </div>

                        {/* Seats around the table */}
                        {Array.from({ length: TABLE_CAPACITY }, (_, seatOffset) => {
                          const seatIndex = tableIndex * TABLE_CAPACITY + seatOffset;
                          const guestId = seatAssignments[seatIndex];
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
                          const guest = guestId
                            ? (attendingGuestMap.get(guestId) ?? null)
                            : null;

                          return (
                            <DroppableSeat
                              key={seatIndex}
                              seatIndex={seatIndex}
                              left={left}
                              top={top}
                              occupied={!!guest}
                              isAnyDragging={!!activeDragGuestId}
                            >
                              {guest ? (
                                <>
                                  <span className='line-clamp-1 max-w-[52px] font-medium'>
                                    {guest.name}
                                  </span>
                                  <button
                                    type='button'
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
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      </section>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragGuest ? (
          <div className='rounded-full border border-rose-300 bg-rose-100 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-lg'>
            {activeDragGuest.name}
            <span className='ml-1 text-stone-400'>
              ({activeDragGuest.side === 'groom' ? '男方' : '女方'})
            </span>
          </div>
        ) : null}
      </DragOverlay>

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
