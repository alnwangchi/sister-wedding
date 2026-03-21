'use client';

import { useEffect, useMemo, useState } from 'react';

import type { RsvpRecord } from '@/types/rsvp';
import { Button } from '@/components/ui/button';
import { SeatingPlannerTab } from '@/components/seating-planner-tab';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const tabs = [
  { id: 'responses', label: '賓客回覆' },
  { id: 'seating', label: '座位安排' },
] as const;

const PAGE_SIZE = 20;

export function AdminDashboard({
  records,
  usingMockData,
}: {
  records: RsvpRecord[];
  usingMockData: boolean;
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('responses');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSides, setSelectedSides] = useState<Array<'groom' | 'bride'>>([]);
  const [selectedVegetarianStatus, setSelectedVegetarianStatus] = useState<Array<'yes' | 'no'>>([]);
  const [selectedAttendingStatus, setSelectedAttendingStatus] = useState<Array<'yes' | 'no'>>([]);
  const [localRecords, setLocalRecords] = useState(records);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<RsvpRecord | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestVegetarian, setNewGuestVegetarian] = useState(false);
  const [newGuestSide, setNewGuestSide] = useState<'groom' | 'bride'>('groom');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  const stats = useMemo(() => {
    const attendingCount = localRecords.filter((record) => record.attending).length;
    const totalGuests = localRecords.reduce((sum, record) => sum + record.guestCount, 0);

    return { attendingCount, totalGuests };
  }, [localRecords]);

  const filteredRecords = useMemo(() => {
    return localRecords.filter((record) => {
      const sideMatched = selectedSides.length === 0 || selectedSides.includes(record.side);
      const vegetarianStatus =
        record.vegetarian === null ? null : record.vegetarian === 'none' ? 'no' : 'yes';
      const vegetarianMatched =
        selectedVegetarianStatus.length === 0 ||
        (vegetarianStatus !== null && selectedVegetarianStatus.includes(vegetarianStatus));
      const attendingMatched =
        selectedAttendingStatus.length === 0 ||
        selectedAttendingStatus.includes(record.attending ? 'yes' : 'no');

      return sideMatched && vegetarianMatched && attendingMatched;
    });
  }, [localRecords, selectedAttendingStatus, selectedSides, selectedVegetarianStatus]);

  function handleDeleteClick(record: RsvpRecord) {
    if (usingMockData) {
      window.alert('目前為展示資料，暫不提供刪除功能。');
      return;
    }

    setPendingDeleteRecord(record);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteRecord) {
      return;
    }

    setDeletingId(pendingDeleteRecord.id);
    try {
      const response = await fetch(`/api/rsvp/${pendingDeleteRecord.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? '刪除失敗，請稍後再試。');
      }

      setLocalRecords((prev) => prev.filter((item) => item.id !== pendingDeleteRecord.id));
      setPendingDeleteRecord(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '刪除失敗，請稍後再試。';
      window.alert(message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateGuest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGuestName.trim();

    if (!name) {
      setCreateError('請輸入姓名。');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      if (usingMockData) {
        const createdRecord: RsvpRecord = {
          id: `mock-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
          name,
          phone: '',
          attending: true,
          guestCount: 0,
          email: '',
          vegetarian: newGuestVegetarian ? 'vegetarian' : 'none',
          side: newGuestSide,
          message: '',
          seatAssigned: false,
          createdAt: new Date().toISOString(),
        };
        setLocalRecords((prev) => [createdRecord, ...prev]);
        setCurrentPage(1);
        setCreateDialogOpen(false);
        setNewGuestName('');
        setNewGuestVegetarian(false);
        setNewGuestSide('groom');
        return;
      }

      const response = await fetch('/api/rsvp/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          vegetarian: newGuestVegetarian,
          side: newGuestSide,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        record?: RsvpRecord;
      } | null;

      if (!response.ok || !payload?.record) {
        throw new Error(payload?.message ?? '新增失敗，請稍後再試。');
      }

      const createdRecord = payload.record;
      setLocalRecords((prev) => [createdRecord, ...prev]);
      setCurrentPage(1);
      setCreateDialogOpen(false);
      setNewGuestName('');
      setNewGuestVegetarian(false);
      setNewGuestSide('groom');
    } catch (error) {
      const message = error instanceof Error ? error.message : '新增失敗，請稍後再試。';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentRecords = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRecords, safeCurrentPage]);
  const pageSummary = useMemo(() => {
    if (filteredRecords.length === 0) {
      return '0-0 / 0';
    }

    const start = (safeCurrentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safeCurrentPage * PAGE_SIZE, filteredRecords.length);

    return `${start}-${end} / ${filteredRecords.length}`;
  }, [filteredRecords.length, safeCurrentPage]);

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-3'>
        <StatCard label='總回覆數' value={String(localRecords.length)} />
        <StatCard label='會出席組數' value={String(stats.attendingCount)} />
        <StatCard label='預估總人數' value={String(stats.totalGuests)} />
      </div>

      {usingMockData ? (
        <div className='rounded-[1.75rem] border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-700 shadow-sm'>
          目前為 Mock 模式（網址帶有 ?mock=true），資料僅供示範，不會寫入 Firebase。
        </div>
      ) : null}

      <div className='flex gap-3'>
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            className={`h-auto rounded-full px-5 py-2 ${
              activeTab === tab.id ? '' : 'border-rose-100 text-stone-600'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'responses' ? (
        <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
          {localRecords.length === 0 ? (
            <div className='rounded-3xl bg-amber-50 px-5 py-8 text-center text-sm text-amber-700'>
              目前還沒有收到表單資料，等賓客送出後就會顯示在這裡。
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='space-y-3 rounded-3xl border border-rose-100 bg-rose-50/40 p-4 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <p className='font-semibold text-stone-700'>篩選條件</p>
                  <Button
                    type='button'
                    onClick={() => {
                      setCurrentPage(1);
                      setSelectedSides([]);
                      setSelectedVegetarianStatus([]);
                      setSelectedAttendingStatus([]);
                    }}
                    variant='outline'
                    size='sm'
                    className='ml-auto h-auto rounded-full px-2.5 py-1 text-[11px]'
                  >
                    清除篩選
                  </Button>
                </div>
                <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
                  <FilterGroup
                    label='男方 / 女方'
                    options={[
                      { value: 'groom', label: '男方' },
                      { value: 'bride', label: '女方' },
                    ]}
                    selectedValues={selectedSides}
                    onToggle={(value) => {
                      setCurrentPage(1);
                      toggleMultiSelect(value, setSelectedSides);
                    }}
                  />

                  <FilterGroup
                    label='吃素'
                    options={[
                      { value: 'yes', label: '素食' },
                      { value: 'no', label: '不素' },
                    ]}
                    selectedValues={selectedVegetarianStatus}
                    onToggle={(value) => {
                      setCurrentPage(1);
                      toggleMultiSelect(value, setSelectedVegetarianStatus);
                    }}
                  />

                  <FilterGroup
                    label='是否參加'
                    options={[
                      { value: 'yes', label: '參加' },
                      { value: 'no', label: '不參加' },
                    ]}
                    selectedValues={selectedAttendingStatus}
                    onToggle={(value) => {
                      setCurrentPage(1);
                      toggleMultiSelect(value, setSelectedAttendingStatus);
                    }}
                  />
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className='rounded-3xl bg-amber-50 px-5 py-8 text-center text-sm text-amber-700'>
                  目前篩選條件下沒有資料，請調整篩選條件後再試。
                </div>
              ) : null}

              <div className='rounded-3xl border border-rose-100'>
                <div className='flex items-center justify-end border-b border-rose-100 px-4 py-3'>
                  <Button
                    type='button'
                    size='icon'
                    onClick={() => {
                      setCreateError('');
                      setCreateDialogOpen(true);
                    }}
                    className='h-8 w-8 rounded-full'
                    title='新增賓客'
                  >
                    <span className='text-lg leading-none'>＋</span>
                    <span className='sr-only'>新增賓客</span>
                  </Button>
                </div>
                <Table>
                  <TableCaption>每頁顯示 20 筆，可搭配上方篩選條件快速檢視資料。</TableCaption>
                  <TableHeader>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead>姓名</TableHead>
                      <TableHead>電話</TableHead>
                      <TableHead>是否參加</TableHead>
                      <TableHead>人數</TableHead>
                      <TableHead>電子信箱</TableHead>
                      <TableHead>吃素需求</TableHead>
                      <TableHead>親友別</TableHead>
                      <TableHead>座位安排</TableHead>
                      <TableHead className='min-w-[16rem]'>留言</TableHead>
                      <TableHead className='w-20 text-center'>刪除</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className='font-medium text-stone-700'>{record.name}</TableCell>
                        <TableCell>{record.phone}</TableCell>
                        <TableCell>{record.attending ? '會參加' : '無法參加'}</TableCell>
                        <TableCell>{record.guestCount}</TableCell>
                        <TableCell>{record.email}</TableCell>
                        <TableCell>
                          {record.vegetarian === null ? '—' : vegetarianLabel[record.vegetarian]}
                        </TableCell>
                        <TableCell>{record.side === 'groom' ? '男方' : '女方'}</TableCell>
                        <TableCell>
                          {record.attending
                            ? record.seatAssigned
                              ? '已安排'
                              : '未安排'
                            : '不適用'}
                        </TableCell>
                        <TableCell>{record.message || '—'}</TableCell>
                        <TableCell className='text-center'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => handleDeleteClick(record)}
                            disabled={deletingId === record.id || usingMockData}
                            className='cursor-pointer text-rose-500 hover:text-rose-600'
                            title={usingMockData ? '展示資料不可刪除' : '刪除資料'}
                          >
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='2'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              aria-hidden='true'
                              className='size-4'
                            >
                              <path d='M3 6h18' />
                              <path d='M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2' />
                              <path d='M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6' />
                              <path d='M10 11v6' />
                              <path d='M14 11v6' />
                            </svg>
                            <span className='sr-only'>刪除 {record.name}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className='flex flex-col gap-3 text-sm text-stone-500 md:flex-row md:items-center md:justify-between'>
                <p>
                  目前顯示第 {safeCurrentPage} 頁，區間 {pageSummary}
                </p>
                <div className='flex items-center gap-2'>
                  <Button
                    type='button'
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, Math.min(page, totalPages) - 1))
                    }
                    disabled={safeCurrentPage === 1}
                    variant='outline'
                    className='h-auto rounded-full px-4 py-2 disabled:border-stone-200 disabled:text-stone-300'
                  >
                    上一頁
                  </Button>
                  <span className='min-w-16 text-center font-medium text-stone-700'>
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <Button
                    type='button'
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, Math.min(page, totalPages) + 1))
                    }
                    disabled={safeCurrentPage === totalPages}
                    variant='outline'
                    className='h-auto rounded-full px-4 py-2 disabled:border-stone-200 disabled:text-stone-300'
                  >
                    下一頁
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <SeatingPlannerTab records={localRecords} />
      )}

      <Dialog
        open={pendingDeleteRecord !== null}
        onOpenChange={(open) => !open && setPendingDeleteRecord(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除資料</DialogTitle>
            <DialogDescription>
              你即將刪除「{pendingDeleteRecord?.name ?? '這筆回覆'}」的 RSVP
              資料，刪除後無法復原。是否確定刪除？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setPendingDeleteRecord(null)}
              disabled={deletingId !== null}
            >
              取消
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={() => void handleConfirmDelete()}
              disabled={deletingId !== null}
            >
              確認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreateError('');
            setNewGuestName('');
            setNewGuestVegetarian(false);
            setNewGuestSide('groom');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增賓客</DialogTitle>
            <DialogDescription>請填寫姓名、是否吃素與男方/女方，其餘資料會套用預設值。</DialogDescription>
          </DialogHeader>
          <form className='space-y-4 mt-2' onSubmit={(event) => void handleCreateGuest(event)}>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <div className='flex flex-1 items-center gap-2'>
                <label
                  htmlFor='new-guest-name'
                  className='shrink-0 text-sm font-medium text-stone-700'
                >
                  姓名
                </label>
                <input
                  id='new-guest-name'
                  value={newGuestName}
                  onChange={(event) => setNewGuestName(event.target.value)}
                  disabled={creating}
                  maxLength={12}
                  className='w-full rounded-xl border border-rose-200 px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200'
                  placeholder='請輸入姓名'
                />
              </div>
              <label className='flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm text-stone-700'>
                <input
                  type='checkbox'
                  checked={newGuestVegetarian}
                  onChange={(event) => setNewGuestVegetarian(event.target.checked)}
                  disabled={creating}
                  className='h-4 w-4 rounded border-rose-300 text-rose-500 focus:ring-rose-400'
                />
                <span>是否吃素</span>
              </label>
            </div>
            <div className='space-y-1.5'>
              <p className='text-sm font-medium text-stone-700'>男方或女方親友</p>
              <div className='grid grid-cols-2 gap-3'>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-side'
                    value='groom'
                    checked={newGuestSide === 'groom'}
                    onChange={() => setNewGuestSide('groom')}
                    disabled={creating}
                  />
                  男方親友
                </label>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-side'
                    value='bride'
                    checked={newGuestSide === 'bride'}
                    onChange={() => setNewGuestSide('bride')}
                    disabled={creating}
                  />
                  女方親友
                </label>
              </div>
            </div>
            {createError ? (
              <p className='rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700'>{createError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                取消
              </Button>
              <Button type='submit' disabled={creating}>
                {creating ? '新增中...' : '新增'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-[1.75rem] border border-rose-100 bg-white/90 p-5 shadow-sm'>
      <p className='text-sm text-stone-400'>{label}</p>
      <p className='mt-3 text-3xl font-semibold text-stone-800'>{value}</p>
    </div>
  );
}

const vegetarianLabel = {
  none: '無',
  vegetarian: '蛋奶素',
  vegan: '全素',
  other: '其他',
} as const;

function toggleMultiSelect<T>(value: T, setter: React.Dispatch<React.SetStateAction<T[]>>) {
  setter((prev) =>
    prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selectedValues: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
      <p className='min-w-16 text-xs text-stone-600'>{label}</p>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
            selectedValues.includes(option.value)
              ? 'border-rose-400 bg-rose-50 text-rose-700'
              : 'border-rose-200 bg-white text-stone-700 hover:border-rose-300'
          }`}
        >
          <input
            type='checkbox'
            checked={selectedValues.includes(option.value)}
            onChange={() => onToggle(option.value)}
            className='h-3 w-3 rounded border-rose-300 text-rose-500 focus:ring-rose-400'
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
