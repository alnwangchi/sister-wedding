'use client';

import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SeatLookupResult = {
  name: string;
  seats: string[];
};

type TableLookupSeat = {
  seatNumber: number;
  guestName: string | null;
};

type TableLookupResult = {
  tableNumber: number;
  tableName: string;
  seats: TableLookupSeat[];
};

type LookupTab = 'guest' | 'table';

const fieldClassName =
  'w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100';

const DIAGRAM_SIZE = 300;
const DIAGRAM_CENTER = DIAGRAM_SIZE / 2;
const DIAGRAM_TABLE_RADIUS = 58;
const DIAGRAM_SEAT_RADIUS = 108;
const DIAGRAM_SEAT_SIZE = 56;

function TableSeatDiagram({ result }: { result: TableLookupResult }) {
  const occupiedNames = result.seats
    .map((seat) => seat.guestName)
    .filter((name): name is string => Boolean(name));

  return (
    <div className='space-y-4'>
      <div className='overflow-x-auto'>
        <div
          className='relative mx-auto shrink-0'
          style={{ width: DIAGRAM_SIZE, height: DIAGRAM_SIZE }}
          aria-label={`${result.tableName} 座位圖`}
        >
          <div
            className='absolute flex items-center justify-center rounded-full border-2 border-rose-200 bg-white text-center shadow-sm'
            style={{
              width: DIAGRAM_TABLE_RADIUS * 2,
              height: DIAGRAM_TABLE_RADIUS * 2,
              left: DIAGRAM_CENTER - DIAGRAM_TABLE_RADIUS,
              top: DIAGRAM_CENTER - DIAGRAM_TABLE_RADIUS,
            }}
          >
            <div className='px-2'>
              <p className='text-xs text-stone-400'>第 {result.tableNumber} 桌</p>
              <p className='mt-0.5 line-clamp-2 text-sm font-semibold text-stone-700'>
                {result.tableName}
              </p>
            </div>
          </div>

          {result.seats.map((seat, index) => {
            const angle = (index / result.seats.length) * Math.PI * 2 - Math.PI / 2;
            const left =
              DIAGRAM_CENTER + DIAGRAM_SEAT_RADIUS * Math.cos(angle) - DIAGRAM_SEAT_SIZE / 2;
            const top =
              DIAGRAM_CENTER + DIAGRAM_SEAT_RADIUS * Math.sin(angle) - DIAGRAM_SEAT_SIZE / 2;
            const occupied = Boolean(seat.guestName);

            return (
              <div
                key={seat.seatNumber}
                className={cn(
                  'absolute flex flex-col items-center justify-center rounded-full border text-center',
                  occupied
                    ? 'border-rose-300 bg-rose-100 text-stone-700'
                    : 'border-dashed border-stone-300 bg-white text-stone-400',
                )}
                style={{
                  left,
                  top,
                  width: DIAGRAM_SEAT_SIZE,
                  height: DIAGRAM_SEAT_SIZE,
                }}
                title={seat.guestName ?? `${seat.seatNumber} 號位（空）`}
              >
                {occupied ? (
                  <span className='line-clamp-2 max-w-[48px] px-0.5 text-[10px] font-medium leading-tight'>
                    {seat.guestName}
                  </span>
                ) : (
                  <span className='text-[10px]'>{seat.seatNumber} 號</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className='rounded-3xl border border-rose-100 bg-rose-50/50 px-5 py-4'>
        <p className='text-sm font-semibold text-stone-700'>
          {result.tableName}
          <span className='ml-2 font-normal text-stone-400'>
            （第 {result.tableNumber} 桌・{occupiedNames.length}/{result.seats.length} 人）
          </span>
        </p>
        {occupiedNames.length > 0 ? (
          <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
            {result.seats
              .filter((seat) => seat.guestName)
              .map((seat) => (
                <li
                  key={seat.seatNumber}
                  className='rounded-2xl bg-white px-3 py-2 text-sm text-stone-700'
                >
                  <span className='text-stone-400'>{seat.seatNumber} 號位</span>
                  <span className='mx-2 text-stone-300'>·</span>
                  <span className='font-medium'>{seat.guestName}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className='mt-2 text-sm text-stone-500'>此桌目前尚未安排賓客。</p>
        )}
      </div>
    </div>
  );
}

function GuestSeatSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SeatLookupResult[]>([]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error('請輸入姓名或電話');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/rsvp/seat-lookup?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as { results?: SeatLookupResult[]; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? '查詢失敗');
      }
      setResults(data.results ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '查詢失敗';
      toast.error(message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className='space-y-6'>
      <form onSubmit={(e) => void handleSearch(e)} className='space-y-3'>
        <label htmlFor='seat-lookup-query' className='block text-sm font-medium text-stone-700'>
          姓名或電話
        </label>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <input
            id='seat-lookup-query'
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='例如：王小明，或 0912…'
            autoComplete='off'
            className={fieldClassName}
            disabled={isSearching}
          />
          <Button
            type='submit'
            className='h-auto shrink-0 rounded-full px-6 py-3 sm:self-stretch'
            disabled={isSearching}
          >
            <Search aria-hidden='true' className='size-4' />
            {isSearching ? '查詢中…' : '查詢座位'}
          </Button>
        </div>
      </form>

      {hasSearched ? (
        <div className='space-y-3'>
          {results.length === 0 ? (
            <p className='rounded-2xl bg-rose-50/80 px-4 py-3 text-sm text-stone-600'>
              找不到符合的賓客，請確認姓名或電話是否正確。
            </p>
          ) : (
            <ul className='space-y-3'>
              {results.map((result, index) => (
                <li
                  key={`${result.name}-${index}`}
                  className='rounded-3xl border border-rose-100 bg-rose-50/50 px-5 py-4'
                >
                  <p className='text-base font-semibold text-stone-800'>{result.name}</p>
                  {result.seats.length > 0 ? (
                    <ul className='mt-2 space-y-1'>
                      {result.seats.map((seat) => (
                        <li key={seat} className='text-sm text-stone-600'>
                          <span className='text-stone-400'>座位：</span>
                          <span className='font-medium text-rose-600'>{seat}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className='mt-2 text-sm text-stone-500'>尚未安排座位，請洽詢現場服務人員。</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className='rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-500'>
          輸入您在回覆表單留下的姓名或電話，即可查詢桌次與座位。同行多位會一併顯示。
        </p>
      )}
    </div>
  );
}

function TableSeatSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<TableLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    const tableNumber = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      toast.error('請輸入有效的桌號（例如 1、15）');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/rsvp/table-lookup?n=${encodeURIComponent(String(tableNumber))}`);
      const data = (await res.json()) as { result?: TableLookupResult; message?: string };
      if (res.status === 404) {
        setResult(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.message ?? '查詢失敗');
      }
      setResult(data.result ?? null);
      setNotFound(!data.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '查詢失敗';
      toast.error(message);
      setResult(null);
      setNotFound(false);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className='space-y-6'>
      <form onSubmit={(e) => void handleSearch(e)} className='space-y-3'>
        <label htmlFor='table-lookup-query' className='block text-sm font-medium text-stone-700'>
          桌號
        </label>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <input
            id='table-lookup-query'
            type='number'
            inputMode='numeric'
            min={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='例如：1、15'
            autoComplete='off'
            className={fieldClassName}
            disabled={isSearching}
          />
          <Button
            type='submit'
            className='h-auto shrink-0 rounded-full px-6 py-3 sm:self-stretch'
            disabled={isSearching}
          >
            <Search aria-hidden='true' className='size-4' />
            {isSearching ? '查詢中…' : '查詢桌次'}
          </Button>
        </div>
      </form>

      {hasSearched ? (
        notFound || !result ? (
          <p className='rounded-2xl bg-rose-50/80 px-4 py-3 text-sm text-stone-600'>
            找不到此桌號，請確認後再試。
          </p>
        ) : (
          <TableSeatDiagram result={result} />
        )
      ) : (
        <p className='rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-500'>
          輸入桌號即可查看該桌圓桌位置圖，以及各號位賓客姓名。
        </p>
      )}
    </div>
  );
}

export function SeatLookupTool() {
  const [tab, setTab] = useState<LookupTab>('guest');

  return (
    <div className='space-y-5'>
      <div
        role='tablist'
        aria-label='查詢類型'
        className='grid grid-cols-2 gap-1 rounded-full border border-rose-100 bg-rose-50/70 p-1'
      >
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'guest'}
          className={cn(
            'rounded-full px-4 py-2.5 text-sm font-medium transition',
            tab === 'guest'
              ? 'bg-white text-rose-600 shadow-sm'
              : 'text-stone-500 hover:text-stone-700',
          )}
          onClick={() => setTab('guest')}
        >
          座位查詢
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'table'}
          className={cn(
            'rounded-full px-4 py-2.5 text-sm font-medium transition',
            tab === 'table'
              ? 'bg-white text-rose-600 shadow-sm'
              : 'text-stone-500 hover:text-stone-700',
          )}
          onClick={() => setTab('table')}
        >
          桌次查詢
        </button>
      </div>

      <div role='tabpanel'>{tab === 'guest' ? <GuestSeatSearch /> : <TableSeatSearch />}</div>
    </div>
  );
}
