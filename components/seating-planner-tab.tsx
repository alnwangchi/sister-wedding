'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';

import type { RsvpRecord } from '@/types/rsvp';
import { Button } from '@/components/ui/button';

const TABLE_CAPACITY = 10;
const DRAG_MIME_TYPE = 'application/x-rsvp-guest-id';

type SeatingPlannerTabProps = {
  records: RsvpRecord[];
};

export function SeatingPlannerTab({ records }: SeatingPlannerTabProps) {
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

  const [seatAssignments, setSeatAssignments] = useState<Array<string | null>>(() =>
    Array.from({ length: TABLE_CAPACITY }, () => null),
  );

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
  }, [attendingGuests]);

  const assignedGuestIds = useMemo(
    () => new Set(seatAssignments.filter((guestId): guestId is string => guestId !== null)),
    [seatAssignments],
  );

  const unassignedGuests = useMemo(
    () => attendingGuests.filter((guest) => !assignedGuestIds.has(guest.id)),
    [assignedGuestIds, attendingGuests],
  );

  const seatedCount = assignedGuestIds.size;

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
    setSeatAssignments(Array.from({ length: TABLE_CAPACITY }, () => null));
  }

  return (
    <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-stone-700'>座位安排（單桌示意）</p>
          <p className='mt-1 text-sm text-stone-500'>
            先拖拉上方賓客到下方圓桌座位，單桌共 {TABLE_CAPACITY} 位。
          </p>
        </div>
        <Button type='button' variant='outline' className='rounded-full' onClick={resetSeats}>
          重置座位
        </Button>
      </div>

      <div className='mt-4 rounded-3xl border border-rose-100 bg-rose-50/40 p-4'>
        <div className='flex items-center justify-between gap-2'>
          <p className='text-xs font-medium text-stone-600'>會出席賓客清單（可拖拉）</p>
          <p className='text-xs text-stone-500'>
            已安排 {seatedCount} / {TABLE_CAPACITY}
          </p>
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

      <div className='mt-6 flex justify-center'>
        <div className='relative h-[360px] w-[360px]'>
          <div className='absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-rose-200 bg-rose-50 shadow-inner'>
            <div className='flex h-full w-full items-center justify-center text-sm font-semibold text-stone-500'>
              主桌 A
            </div>
          </div>

          {seatAssignments.map((guestId, index) => {
            const angle = (index / TABLE_CAPACITY) * Math.PI * 2 - Math.PI / 2;
            const radius = 158;
            const center = 180;
            const seatSize = 68;
            const left = center + radius * Math.cos(angle) - seatSize / 2;
            const top = center + radius * Math.sin(angle) - seatSize / 2;
            const guest = attendingGuests.find((item) => item.id === guestId) ?? null;

            return (
              <div
                key={index}
                onDragOver={handleSeatDragOver}
                onDrop={(event) => handleSeatDrop(event, index)}
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
                      onClick={() => clearSeat(index)}
                      className='mt-1 cursor-pointer rounded-full bg-white px-2 py-0.5 text-[10px] text-stone-500 hover:text-rose-600'
                    >
                      移除
                    </button>
                  </>
                ) : (
                  <span>座位 {index + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
