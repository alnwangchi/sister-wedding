'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Minus, Plus, ZoomIn, ZoomOut } from 'lucide-react';

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

const TABLE_CAPACITY = 10;
const DRAG_MIME_TYPE = 'application/x-rsvp-guest-id';
const TABLE_WIDTH = 360;
const TABLE_HEIGHT = 360;
const TABLE_RADIUS = 158;
const TABLE_CENTER = 180;
const SEAT_SIZE = 68;
const TABLE_GAP = 56;
const TABLES_PER_ROW = 3;
const MAX_TABLE_COUNT = 100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.8;
const DEFAULT_ZOOM = 1;
const CANVAS_PADDING = 56;
const FIXED_CANVAS_WIDTH = 1600;
const FIXED_CANVAS_HEIGHT = 1000;
const TRACKPAD_ZOOM_SENSITIVITY = 0.002;
const SEATING_LAYOUT_STORAGE_KEY = 'wedding-rsvp-seating-layout';

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

type PinchState = {
  initialDistance: number;
  initialZoom: number;
  focalContentX: number;
  focalContentY: number;
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

function getSavedSeatAssignments(records: RsvpRecord[]) {
  const maxSeatOrder = records.reduce((max, record) => {
    if (!record.attending || !record.seatAssigned || typeof record.seatOrder !== 'number') {
      return max;
    }
    return Math.max(max, record.seatOrder);
  }, 0);
  const tableCount = Math.max(1, Math.ceil(maxSeatOrder / TABLE_CAPACITY));
  const seats = Array.from({ length: tableCount * TABLE_CAPACITY }, () => null as string | null);

  records.forEach((record) => {
    if (!record.attending || !record.seatAssigned || typeof record.seatOrder !== 'number') {
      return;
    }

    const seatIndex = record.seatOrder - 1;
    if (seatIndex < 0 || seatIndex >= seats.length || seats[seatIndex] !== null) {
      return;
    }

    seats[seatIndex] = record.id;
  });

  return seats;
}

function getSavedTableLayout(records: RsvpRecord[], fallbackTableCount: number) {
  const savedTableCount = records.reduce((max, record) => {
    if (typeof record.seatingTableCount !== 'number' || !Number.isFinite(record.seatingTableCount)) {
      return max;
    }
    return Math.max(max, Math.floor(record.seatingTableCount));
  }, 0);

  const sourcePositions = records.find((record) => Array.isArray(record.seatingTablePositions))
    ?.seatingTablePositions;
  const safePositions = (sourcePositions ?? []).flatMap((position) => {
    if (
      typeof position.x !== 'number' ||
      !Number.isFinite(position.x) ||
      typeof position.y !== 'number' ||
      !Number.isFinite(position.y)
    ) {
      return [];
    }
    return [clampTablePosition({ x: position.x, y: position.y })];
  });

  const tableCount = Math.max(1, fallbackTableCount, savedTableCount);
  return {
    tableCount,
    tablePositions: resizeTablePositions(safePositions, tableCount),
  };
}

function getLocalStoredTableLayout() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SEATING_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      tableCount?: unknown;
      tablePositions?: unknown;
    };
    if (typeof parsed.tableCount !== 'number' || !Number.isFinite(parsed.tableCount)) {
      return null;
    }
    if (!Array.isArray(parsed.tablePositions)) {
      return null;
    }

    const safePositions = parsed.tablePositions.flatMap((position) => {
      if (
        typeof position !== 'object' ||
        position === null ||
        !('x' in position) ||
        !('y' in position)
      ) {
        return [];
      }
      const candidate = position as { x: unknown; y: unknown };
      if (
        typeof candidate.x !== 'number' ||
        !Number.isFinite(candidate.x) ||
        typeof candidate.y !== 'number' ||
        !Number.isFinite(candidate.y)
      ) {
        return [];
      }
      return [clampTablePosition({ x: candidate.x, y: candidate.y })];
    });

    const tableCount = Math.max(1, Math.floor(parsed.tableCount));
    return {
      tableCount,
      tablePositions: resizeTablePositions(safePositions, tableCount),
    };
  } catch {
    return null;
  }
}

function saveTableLayoutToLocalStorage(tableCount: number, tablePositions: TablePosition[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      SEATING_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        tableCount,
        tablePositions: resizeTablePositions(tablePositions, tableCount).map((position) =>
          clampTablePosition(position),
        ),
      }),
    );
  } catch {
    // Ignore local storage failures (e.g. private mode quota)
  }
}

function resizeAssignments(assignments: Array<string | null>, totalSeats: number) {
  if (assignments.length === totalSeats) {
    return assignments;
  }

  if (assignments.length > totalSeats) {
    return assignments.slice(0, totalSeats);
  }

  return [...assignments, ...Array.from({ length: totalSeats - assignments.length }, () => null)];
}

function getRequiredTableCount(assignments: Array<string | null>) {
  const lastFilledSeatIndex = assignments.reduce((lastIndex, guestId, index) => {
    if (!guestId) {
      return lastIndex;
    }
    return index;
  }, -1);

  return Math.max(1, Math.floor(lastFilledSeatIndex / TABLE_CAPACITY) + 1);
}

function getDefaultTablePosition(tableIndex: number): TablePosition {
  const row = Math.floor(tableIndex / TABLES_PER_ROW);
  const column = tableIndex % TABLES_PER_ROW;
  return {
    x: column * (TABLE_WIDTH + TABLE_GAP),
    y: row * (TABLE_HEIGHT + TABLE_GAP),
  };
}

function resizeTablePositions(positions: TablePosition[], tableCount: number) {
  if (positions.length === tableCount) {
    return positions;
  }

  if (positions.length > tableCount) {
    return positions.slice(0, tableCount);
  }

  return [
    ...positions,
    ...Array.from({ length: tableCount - positions.length }, (_, index) =>
      getDefaultTablePosition(positions.length + index),
    ),
  ];
}

function clampTablePosition(position: TablePosition) {
  return {
    x: Math.max(0, Math.min(position.x, FIXED_CANVAS_WIDTH - TABLE_WIDTH)),
    y: Math.max(0, Math.min(position.y, FIXED_CANVAS_HEIGHT - TABLE_HEIGHT)),
  };
}

export function SeatingPlannerTab({
  records,
  filteredGuestIds,
  filtersPanel,
  onSave,
}: SeatingPlannerTabProps) {
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
        .filter((record) => record.attending)
        .map((record) => ({
          id: record.id,
          name: record.name,
          side: record.side,
        })),
    [records],
  );
  const attendingGuestMap = useMemo(
    () => new Map(attendingGuests.map((guest) => [guest.id, guest])),
    [attendingGuests],
  );

  const filteredGuestIdSet = useMemo(
    () => (filteredGuestIds ? new Set(filteredGuestIds) : null),
    [filteredGuestIds],
  );

  const [tableCount, setTableCount] = useState(() => initialSavedLayout.tableCount);
  const canvasScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const [tablePositions, setTablePositions] = useState<TablePosition[]>(
    () => initialSavedLayout.tablePositions,
  );
  const [draggingTable, setDraggingTable] = useState<DraggingTableState | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(DEFAULT_ZOOM);
  const [seatAssignments, setSeatAssignments] = useState<Array<string | null>>(() =>
    initialSavedAssignments,
  );
  const [lastSavedSeatAssignments, setLastSavedSeatAssignments] = useState<Array<string | null>>(() =>
    initialSavedAssignments,
  );
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const hasServerLayout = records.some(
      (record) =>
        (typeof record.seatingTableCount === 'number' && Number.isFinite(record.seatingTableCount)) ||
        (Array.isArray(record.seatingTablePositions) && record.seatingTablePositions.length > 0),
    );

    if (hasServerLayout) {
      return;
    }

    const localLayout = getLocalStoredTableLayout();
    if (!localLayout) {
      return;
    }

    setTableCount(localLayout.tableCount);
    setTablePositions(localLayout.tablePositions);
  }, [records]);

  useEffect(() => {
    const validGuestIds = new Set(attendingGuests.map((guest) => guest.id));
    setSeatAssignments((prev) =>
      prev.map((guestId) => {
        if (!guestId) {
          return null;
        }
        return validGuestIds.has(guestId) ? guestId : null;
      }),
    );
    setLastSavedSeatAssignments((prev) =>
      prev.map((guestId) => {
        if (!guestId) {
          return null;
        }
        return validGuestIds.has(guestId) ? guestId : null;
      }),
    );
  }, [attendingGuests]);

  useEffect(() => {
    const totalSeats = tableCount * TABLE_CAPACITY;
    setSeatAssignments((prev) => resizeAssignments(prev, totalSeats));
    setLastSavedSeatAssignments((prev) => resizeAssignments(prev, totalSeats));
    setTablePositions((prev) => resizeTablePositions(prev, tableCount));
  }, [tableCount]);

  const assignedGuestIds = useMemo(
    () => new Set(seatAssignments.filter((guestId): guestId is string => guestId !== null)),
    [seatAssignments],
  );

  const unassignedGuests = useMemo(
    () =>
      attendingGuests.filter((guest) => {
        const matchFilter = filteredGuestIdSet ? filteredGuestIdSet.has(guest.id) : true;
        return matchFilter && !assignedGuestIds.has(guest.id);
      }),
    [assignedGuestIds, attendingGuests, filteredGuestIdSet],
  );

  const seatedCount = assignedGuestIds.size;
  const totalSeats = tableCount * TABLE_CAPACITY;
  const requiredTableCount = useMemo(() => getRequiredTableCount(seatAssignments), [seatAssignments]);
  const tableRows = Math.ceil(tableCount / TABLES_PER_ROW);
  const visibleColumns = Math.min(tableCount, TABLES_PER_ROW);
  const defaultCanvasWidth =
    visibleColumns * TABLE_WIDTH + Math.max(0, visibleColumns - 1) * TABLE_GAP + CANVAS_PADDING;
  const defaultCanvasHeight =
    tableRows * TABLE_HEIGHT + Math.max(0, tableRows - 1) * TABLE_GAP + CANVAS_PADDING;
  const canvasWidth = Math.max(defaultCanvasWidth, FIXED_CANVAS_WIDTH);
  const canvasHeight = Math.max(defaultCanvasHeight, FIXED_CANVAS_HEIGHT);
  const zoomedCanvasWidth = Math.round(canvasWidth * canvasZoom);
  const zoomedCanvasHeight = Math.round(canvasHeight * canvasZoom);
  const zoomPercent = Math.round(canvasZoom * 100);
  const hasUnsavedChanges = useMemo(
    () => {
      if (seatAssignments.length !== lastSavedSeatAssignments.length) {
        return true;
      }

      return seatAssignments.some((guestId, index) => guestId !== lastSavedSeatAssignments[index]);
    },
    [lastSavedSeatAssignments, seatAssignments],
  );
  const isDraggingTable = draggingTable !== null;

  useEffect(() => {
    if (!draggingTable) {
      return;
    }
    const currentDrag = draggingTable;

    function handleWindowMouseMove(event: MouseEvent) {
      const deltaX = (event.clientX - currentDrag.startClientX) / canvasZoom;
      const deltaY = (event.clientY - currentDrag.startClientY) / canvasZoom;
      const nextPosition = clampTablePosition({
        x: Math.round(currentDrag.originX + deltaX),
        y: Math.round(currentDrag.originY + deltaY),
      });

      setTablePositions((prev) =>
        prev.map((position, index) =>
          index === currentDrag.tableIndex ? nextPosition : position,
        ),
      );
    }

    function handleWindowMouseUp() {
      setDraggingTable(null);
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [canvasZoom, draggingTable]);

  function handleGuestDragStart(event: DragEvent<HTMLDivElement>, guestId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME_TYPE, guestId);
  }

  function handleSeatDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleSeatDrop(event: DragEvent<HTMLDivElement>, seatIndex: number) {
    event.preventDefault();
    const guestId = event.dataTransfer.getData(DRAG_MIME_TYPE);

    if (!guestId || seatAssignments[seatIndex] !== null) {
      return;
    }

    if (!attendingGuests.some((guest) => guest.id === guestId)) {
      return;
    }

    setSeatAssignments((prev) => {
      const next = [...prev];
      if (next[seatIndex] !== null || next.includes(guestId)) {
        return prev;
      }
      next[seatIndex] = guestId;
      return next;
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
    const normalizedCount = Math.min(MAX_TABLE_COUNT, Math.max(1, Math.floor(nextCount)));

    if (normalizedCount < requiredTableCount) {
      setSaveError(true);
      setSaveMessage(`目前至少需要 ${requiredTableCount} 桌，請先清除後段桌位上的賓客。`);
      return;
    }

    setSaveMessage('');
    setSaveError(false);
    setTableCount(normalizedCount);
  }

  function updateZoom(nextZoom: number) {
    const normalizedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setCanvasZoom(normalizedZoom);
  }

  function updateZoomByDelta(delta: number) {
    setCanvasZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }

  function applyZoomWithFocalPoint(
    nextZoom: number,
    focalContentX: number,
    focalContentY: number,
    viewportX: number,
    viewportY: number,
  ) {
    const normalizedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (normalizedZoom === canvasZoom) {
      return;
    }

    const container = canvasScrollContainerRef.current;
    setCanvasZoom(normalizedZoom);

    if (!container) {
      return;
    }

    const targetScrollLeft = focalContentX * normalizedZoom - viewportX;
    const targetScrollTop = focalContentY * normalizedZoom - viewportY;

    requestAnimationFrame(() => {
      container.scrollLeft = targetScrollLeft;
      container.scrollTop = targetScrollTop;
    });
  }

  function getTouchDistance(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      return null;
    }
    const [touchA, touchB] = [event.touches[0], event.touches[1]];
    return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
  }

  function handleCanvasTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const distance = getTouchDistance(event);
    if (distance === null) {
      return;
    }
    const container = canvasScrollContainerRef.current;
    if (!container) {
      return;
    }

    const [touchA, touchB] = [event.touches[0], event.touches[1]];
    const centerClientX = (touchA.clientX + touchB.clientX) / 2;
    const centerClientY = (touchA.clientY + touchB.clientY) / 2;
    const containerRect = container.getBoundingClientRect();
    const centerXInContainer = centerClientX - containerRect.left;
    const centerYInContainer = centerClientY - containerRect.top;

    pinchStateRef.current = {
      initialDistance: distance,
      initialZoom: canvasZoom,
      focalContentX: (container.scrollLeft + centerXInContainer) / canvasZoom,
      focalContentY: (container.scrollTop + centerYInContainer) / canvasZoom,
    };
  }

  function handleCanvasTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const distance = getTouchDistance(event);
    const pinchState = pinchStateRef.current;
    if (distance === null || !pinchState) {
      return;
    }

    event.preventDefault();
    const zoomScale = distance / pinchState.initialDistance;
    const [touchA, touchB] = [event.touches[0], event.touches[1]];
    const centerClientX = (touchA.clientX + touchB.clientX) / 2;
    const centerClientY = (touchA.clientY + touchB.clientY) / 2;
    const container = canvasScrollContainerRef.current;

    if (!container) {
      updateZoom(pinchState.initialZoom * zoomScale);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const centerXInContainer = centerClientX - containerRect.left;
    const centerYInContainer = centerClientY - containerRect.top;
    applyZoomWithFocalPoint(
      pinchState.initialZoom * zoomScale,
      pinchState.focalContentX,
      pinchState.focalContentY,
      centerXInContainer,
      centerYInContainer,
    );
  }

  function handleCanvasTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) {
      pinchStateRef.current = null;
    }
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const container = canvasScrollContainerRef.current;
    if (!container) {
      updateZoomByDelta(-event.deltaY * TRACKPAD_ZOOM_SENSITIVITY);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pointerXInContainer = event.clientX - containerRect.left;
    const pointerYInContainer = event.clientY - containerRect.top;
    const focalContentX = (container.scrollLeft + pointerXInContainer) / canvasZoom;
    const focalContentY = (container.scrollTop + pointerYInContainer) / canvasZoom;
    applyZoomWithFocalPoint(
      canvasZoom - event.deltaY * TRACKPAD_ZOOM_SENSITIVITY,
      focalContentX,
      focalContentY,
      pointerXInContainer,
      pointerYInContainer,
    );
  }

  function handleTableMouseDown(event: ReactMouseEvent<HTMLDivElement>, tableIndex: number) {
    event.preventDefault();
    const currentPosition = tablePositions[tableIndex] ?? getDefaultTablePosition(tableIndex);
    setDraggingTable({
      tableIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: currentPosition.x,
      originY: currentPosition.y,
    });
  }

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

      const normalizedTablePositions = resizeTablePositions(tablePositions, tableCount).map((position) =>
        clampTablePosition(position),
      );
      await onSave(assignments, {
        tableCount,
        tablePositions: normalizedTablePositions,
      });
      saveTableLayoutToLocalStorage(tableCount, normalizedTablePositions);
      setLastSavedSeatAssignments([...seatAssignments]);
      setSaveMessage('座位安排已儲存。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '儲存失敗，請稍後再試。';
      setSaveMessage(message);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
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
                onChange={(event) => {
                  const rawValue = Number(event.target.value);
                  if (!Number.isFinite(rawValue)) {
                    return;
                  }
                  updateTableCount(rawValue);
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
              <div
                key={guest.id}
                draggable
                onDragStart={(event) => handleGuestDragStart(event, guest.id)}
                className='cursor-grab rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 active:cursor-grabbing'
              >
                {guest.name}
                <span className='ml-1 text-stone-400'>({guest.side === 'groom' ? '男方' : '女方'})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='mt-6'>
        <div className='mb-3 flex items-center justify-end gap-2 text-xs text-stone-500'>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='h-7 w-7 rounded-full'
            onClick={() => updateZoom(canvasZoom - 0.1)}
            disabled={canvasZoom <= MIN_ZOOM}
          >
            <ZoomOut aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>縮小畫布</span>
          </Button>
          <input
            type='range'
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={canvasZoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            className='w-28 accent-rose-500'
            aria-label='畫布縮放'
          />
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='h-7 w-7 rounded-full'
            onClick={() => updateZoom(canvasZoom + 0.1)}
            disabled={canvasZoom >= MAX_ZOOM}
          >
            <ZoomIn aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>放大畫布</span>
          </Button>
          <span className='min-w-[3.5rem] text-right'>{zoomPercent}%</span>
        </div>

        <div
          className='overflow-auto rounded-3xl border border-rose-100 bg-rose-50/30 p-4'
          ref={canvasScrollContainerRef}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchEnd}
          onWheel={handleCanvasWheel}
        >
          <div
            className='relative'
            style={{
              width: `${zoomedCanvasWidth}px`,
              height: `${zoomedCanvasHeight}px`,
            }}
          >
            <div
              className='relative origin-top-left'
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                transform: `scale(${canvasZoom})`,
              }}
            >
              {Array.from({ length: tableCount }, (_, tableIndex) => {
                const tableNumber = tableIndex + 1;
                const tablePosition = clampTablePosition(
                  tablePositions[tableIndex] ?? getDefaultTablePosition(tableIndex),
                );
                const tableLeft = tablePosition.x;
                const tableTop = tablePosition.y;

                return (
                  <div key={tableNumber}>
                    <div
                      className={`absolute h-48 w-48 rounded-full border-4 border-rose-200 bg-rose-50 shadow-inner ${
                        isDraggingTable ? '' : 'transition-colors'
                      } ${isDraggingTable && draggingTable?.tableIndex === tableIndex ? 'cursor-grabbing border-rose-300' : 'cursor-grab'}`}
                      style={{
                        left: tableLeft + TABLE_CENTER - 96,
                        top: tableTop + TABLE_CENTER - 96,
                      }}
                      onMouseDown={(event) => handleTableMouseDown(event, tableIndex)}
                    >
                      <div className='flex h-full w-full items-center justify-center text-sm font-semibold text-stone-500'>
                        第 {tableNumber} 桌
                      </div>
                    </div>

                    {Array.from({ length: TABLE_CAPACITY }, (_, seatOffset) => {
                      const seatIndex = tableIndex * TABLE_CAPACITY + seatOffset;
                      const guestId = seatAssignments[seatIndex];
                      const angle = (seatOffset / TABLE_CAPACITY) * Math.PI * 2 - Math.PI / 2;
                      const left =
                        tableLeft + TABLE_CENTER + TABLE_RADIUS * Math.cos(angle) - SEAT_SIZE / 2;
                      const top =
                        tableTop + TABLE_CENTER + TABLE_RADIUS * Math.sin(angle) - SEAT_SIZE / 2;
                      const guest = guestId ? (attendingGuestMap.get(guestId) ?? null) : null;

                      return (
                        <div
                          key={seatIndex}
                          onDragOver={handleSeatDragOver}
                          onDrop={(event) => handleSeatDrop(event, seatIndex)}
                          className={`absolute flex h-[68px] w-[68px] select-none flex-col items-center justify-center rounded-full border text-center text-[11px] ${
                            guest
                              ? 'border-rose-300 bg-rose-100 text-stone-700'
                              : 'border-dashed border-stone-300 bg-white text-stone-400'
                          }`}
                          style={{ left, top }}
                        >
                          {guest ? (
                            <>
                              <span className='line-clamp-1 max-w-[52px] font-medium'>{guest.name}</span>
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
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
    </section>
  );
}
