'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Copy,
  Mail,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import type { RelationshipTag, RsvpRecord } from '@/types/rsvp';
import { GuestSideLabel } from '@/components/guest-side-icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RsvpFiltersPanel,
  type BinaryFilter,
  type RelationshipTagFilter,
  type SideFilter,
} from '@/components/rsvp-filters-panel';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'responses', label: '賓客回覆' },
  { id: 'seating', label: '座位安排' },
] as const;

const PAGE_SIZE = 20;

const MESSAGE_CELL_HEIGHT_CLASS = 'h-[2.875rem]';

function MessageTableCell({ message }: { message: string }) {
  const trimmed = message.trim();
  if (!trimmed) {
    return (
      <div
        className={cn(MESSAGE_CELL_HEIGHT_CLASS, 'flex max-w-[16rem] items-center text-stone-400')}
      >
        —
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className={cn(
            MESSAGE_CELL_HEIGHT_CLASS,
            'min-w-0 w-full max-w-[16rem] rounded-md border-0 bg-transparent p-0 text-left text-sm leading-relaxed text-stone-700 outline-offset-2 transition-colors hover:bg-rose-50/50 focus-visible:ring-2 focus-visible:ring-rose-200',
          )}
        >
          <span className='line-clamp-2 break-words'>{trimmed}</span>
          <span className='sr-only'>完整留言於提示中</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side='top'
        align='start'
        className='max-w-[200px] max-h-[min(60vh,24rem)] overflow-y-auto whitespace-pre-wrap'
      >
        {trimmed}
      </TooltipContent>
    </Tooltip>
  );
}

function CopyableTableCell({ rawText, copyLabel }: { rawText: string; copyLabel: string }) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return <>—</>;
  }

  return (
    <div className='flex items-center justify-center gap-1.5'>
      <span className='min-w-0 max-w-full break-words'>{trimmed}</span>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-8 shrink-0 text-stone-500 hover:text-stone-800'
        title='複製'
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(trimmed);
            toast.success('已複製');
          } catch {
            toast.error('無法複製，請手動選取文字');
          }
        }}
      >
        <Copy aria-hidden='true' className='size-4' />
        <span className='sr-only'>{copyLabel}</span>
      </Button>
    </div>
  );
}

function CollapsibleContactColumnHead({
  label,
  expanded,
  onToggle,
  icon: Icon,
  expandLabel,
  collapseLabel,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  icon: LucideIcon;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <TableHead className={cn(expanded ? '' : 'w-fit px-1')}>
      <button
        type='button'
        className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-0.5 rounded-md font-medium text-stone-500 transition hover:bg-rose-50/80 hover:text-stone-800',
          'flex-row px-1 py-1',
        )}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? collapseLabel : expandLabel}
        title={expanded ? collapseLabel : expandLabel}
      >
        {expanded ? (
          <>
            <span className='whitespace-nowrap'>{label}</span>
            <ChevronLeft aria-hidden='true' className='size-4 shrink-0 opacity-70' />
          </>
        ) : (
          <>
            <Icon aria-hidden='true' className='size-4 shrink-0 opacity-80' />
            <ChevronRight aria-hidden='true' className='size-4 shrink-0 opacity-70' />
          </>
        )}
      </button>
    </TableHead>
  );
}

type SeatingAssignmentPayload = {
  id: string;
  seatOrder: number;
  seatPosition: string;
};

type SeatingLayoutPayload = {
  tableCount: number;
  tablePositions: Array<{ x: number; y: number }>;
  tableNames: string[];
};

function groupSeatingAssignmentsByGuestId(assignments: SeatingAssignmentPayload[]) {
  const map = new Map<string, SeatingAssignmentPayload[]>();
  for (const item of assignments) {
    const list = map.get(item.id) ?? [];
    list.push(item);
    map.set(item.id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.seatOrder - b.seatOrder);
  }
  return map;
}

export function AdminDashboard({
  records,
  usingMockData,
}: {
  records: RsvpRecord[];
  usingMockData: boolean;
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('responses');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSides, setSelectedSides] = useState<SideFilter[]>([]);
  const [selectedRelationshipTags, setSelectedRelationshipTags] = useState<RelationshipTagFilter[]>(
    [],
  );
  const [selectedVegetarianStatus, setSelectedVegetarianStatus] = useState<BinaryFilter[]>([]);
  const [selectedAttendingStatus, setSelectedAttendingStatus] = useState<BinaryFilter[]>([]);
  const [selectedSingleStatus, setSelectedSingleStatus] = useState<BinaryFilter[]>([]);
  const [selectedPaperInvitationStatus, setSelectedPaperInvitationStatus] = useState<
    BinaryFilter[]
  >([]);
  const [localRecords, setLocalRecords] = useState(records);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<RsvpRecord | null>(null);
  const [showPhoneColumn, setShowPhoneColumn] = useState(true);
  const [showEmailColumn, setShowEmailColumn] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestVegetarian, setNewGuestVegetarian] = useState(false);
  const [newGuestSide, setNewGuestSide] = useState<'groom' | 'bride'>('groom');
  const [newGuestRelationshipTag, setNewGuestRelationshipTag] = useState<RelationshipTag>('friend');
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

  const filteredRecordsForResponses = useMemo(() => {
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
      const singleStatus =
        record.isSingle === true ? 'yes' : record.isSingle === false ? 'no' : null;
      const singleMatched =
        selectedSingleStatus.length === 0 ||
        (singleStatus !== null && selectedSingleStatus.includes(singleStatus));
      const relationshipTagMatched =
        selectedRelationshipTags.length === 0 ||
        selectedRelationshipTags.includes(record.relationshipTag);
      const paperInvitationMatched =
        selectedPaperInvitationStatus.length === 0 ||
        selectedPaperInvitationStatus.includes(record.needsPaperInvitation ? 'yes' : 'no');

      return (
        sideMatched &&
        vegetarianMatched &&
        attendingMatched &&
        singleMatched &&
        relationshipTagMatched &&
        paperInvitationMatched
      );
    });
  }, [
    localRecords,
    selectedAttendingStatus,
    selectedPaperInvitationStatus,
    selectedRelationshipTags,
    selectedSides,
    selectedSingleStatus,
    selectedVegetarianStatus,
  ]);

  const filteredRecordsForSeating = useMemo(() => {
    return localRecords.filter((record) => {
      const sideMatched = selectedSides.length === 0 || selectedSides.includes(record.side);
      const vegetarianStatus =
        record.vegetarian === null ? null : record.vegetarian === 'none' ? 'no' : 'yes';
      const vegetarianMatched =
        selectedVegetarianStatus.length === 0 ||
        (vegetarianStatus !== null && selectedVegetarianStatus.includes(vegetarianStatus));
      const singleStatus =
        record.isSingle === true ? 'yes' : record.isSingle === false ? 'no' : null;
      const singleMatched =
        selectedSingleStatus.length === 0 ||
        (singleStatus !== null && selectedSingleStatus.includes(singleStatus));
      const relationshipTagMatched =
        selectedRelationshipTags.length === 0 ||
        selectedRelationshipTags.includes(record.relationshipTag);
      const paperInvitationMatched =
        selectedPaperInvitationStatus.length === 0 ||
        selectedPaperInvitationStatus.includes(record.needsPaperInvitation ? 'yes' : 'no');

      return (
        sideMatched &&
        vegetarianMatched &&
        singleMatched &&
        relationshipTagMatched &&
        paperInvitationMatched
      );
    });
  }, [
    localRecords,
    selectedPaperInvitationStatus,
    selectedRelationshipTags,
    selectedSides,
    selectedSingleStatus,
    selectedVegetarianStatus,
  ]);

  const filteredGuestIdsForSeating = useMemo(
    () => filteredRecordsForSeating.map((record) => record.id),
    [filteredRecordsForSeating],
  );

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
          relationshipTag: newGuestRelationshipTag,
          isSingle: null,
          needsPaperInvitation: false,
          mailingAddress: '',
          message: '',
          seatAssigned: false,
          seatOrder: null,
          seatPosition: null,
          seatSlots: null,
          seatingTableCount: null,
          seatingTablePositions: null,
          seatingTableNames: null,
          createdAt: new Date().toISOString(),
        };
        setLocalRecords((prev) => [createdRecord, ...prev]);
        setCurrentPage(1);
        setCreateDialogOpen(false);
        setNewGuestName('');
        setNewGuestVegetarian(false);
        setNewGuestSide('groom');
        setNewGuestRelationshipTag('friend');
        return;
      }

      const response = await fetch('/api/rsvp/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          vegetarian: newGuestVegetarian,
          side: newGuestSide,
          relationshipTag: newGuestRelationshipTag,
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
      setNewGuestRelationshipTag('friend');
    } catch (error) {
      const message = error instanceof Error ? error.message : '新增失敗，請稍後再試。';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveSeating(
    assignments: SeatingAssignmentPayload[],
    seatingLayout: SeatingLayoutPayload,
  ) {
    if (usingMockData) {
      const slotsByGuest = groupSeatingAssignmentsByGuestId(assignments);
      setLocalRecords((prev) =>
        prev.map((record) => {
          const slots = slotsByGuest.get(record.id);
          if (slots && slots.length > 0 && record.attending) {
            const first = slots[0]!;
            return {
              ...record,
              seatAssigned: true,
              seatOrder: first.seatOrder,
              seatPosition: first.seatPosition,
              seatSlots: slots.map((s) => ({
                seatOrder: s.seatOrder,
                seatPosition: s.seatPosition,
              })),
              seatingTableCount: seatingLayout.tableCount,
              seatingTablePositions: seatingLayout.tablePositions,
              seatingTableNames: seatingLayout.tableNames,
            };
          }

          return {
            ...record,
            seatAssigned: false,
            seatOrder: null,
            seatPosition: null,
            seatSlots: null,
            seatingTableCount: seatingLayout.tableCount,
            seatingTablePositions: seatingLayout.tablePositions,
            seatingTableNames: seatingLayout.tableNames,
          };
        }),
      );
      return;
    }

    const response = await fetch('/api/rsvp/seating', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments,
        tableCount: seatingLayout.tableCount,
        tablePositions: seatingLayout.tablePositions,
        tableNames: seatingLayout.tableNames,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? '儲存座位失敗，請稍後再試。');
    }

    const slotsByGuest = groupSeatingAssignmentsByGuestId(assignments);
    setLocalRecords((prev) =>
      prev.map((record) => {
        const slots = slotsByGuest.get(record.id);
        if (slots && slots.length > 0 && record.attending) {
          const first = slots[0]!;
          return {
            ...record,
            seatAssigned: true,
            seatOrder: first.seatOrder,
            seatPosition: first.seatPosition,
            seatSlots: slots.map((s) => ({
              seatOrder: s.seatOrder,
              seatPosition: s.seatPosition,
            })),
            seatingTableCount: seatingLayout.tableCount,
            seatingTablePositions: seatingLayout.tablePositions,
            seatingTableNames: seatingLayout.tableNames,
          };
        }

        return {
          ...record,
          seatAssigned: false,
          seatOrder: null,
          seatPosition: null,
          seatSlots: null,
          seatingTableCount: seatingLayout.tableCount,
          seatingTablePositions: seatingLayout.tablePositions,
          seatingTableNames: seatingLayout.tableNames,
        };
      }),
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredRecordsForResponses.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentRecords = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredRecordsForResponses.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRecordsForResponses, safeCurrentPage]);
  const pageSummary = useMemo(() => {
    if (filteredRecordsForResponses.length === 0) {
      return '0-0 / 0';
    }

    const start = (safeCurrentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safeCurrentPage * PAGE_SIZE, filteredRecordsForResponses.length);

    return `${start}-${end} / ${filteredRecordsForResponses.length}`;
  }, [filteredRecordsForResponses.length, safeCurrentPage]);

  const clearFilters = () => {
    setCurrentPage(1);
    setSelectedSides([]);
    setSelectedRelationshipTags([]);
    setSelectedVegetarianStatus([]);
    setSelectedAttendingStatus([]);
    setSelectedSingleStatus([]);
    setSelectedPaperInvitationStatus([]);
  };

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

      <div className='flex items-center justify-between gap-3'>
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
            <Plus aria-hidden='true' className='size-4' />
            <span className='sr-only'>新增賓客</span>
          </Button>
        ) : null}
      </div>

      {activeTab === 'responses' ? (
        <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
          {localRecords.length === 0 ? (
            <div className='rounded-3xl bg-amber-50 px-5 py-8 text-center text-sm text-amber-700'>
              目前還沒有收到表單資料，等賓客送出後就會顯示在這裡。
            </div>
          ) : (
            <div className='space-y-4'>
              <RsvpFiltersPanel
                selectedSides={selectedSides}
                selectedRelationshipTags={selectedRelationshipTags}
                selectedVegetarianStatus={selectedVegetarianStatus}
                selectedAttendingStatus={selectedAttendingStatus}
                selectedSingleStatus={selectedSingleStatus}
                selectedPaperInvitationStatus={selectedPaperInvitationStatus}
                onToggleSide={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedSides);
                }}
                onToggleRelationshipTag={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedRelationshipTags);
                }}
                onToggleVegetarianStatus={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedVegetarianStatus);
                }}
                onToggleAttendingStatus={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedAttendingStatus);
                }}
                onToggleSingleStatus={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedSingleStatus);
                }}
                onTogglePaperInvitationStatus={(value) => {
                  setCurrentPage(1);
                  toggleMultiSelect(value, setSelectedPaperInvitationStatus);
                }}
                onClearFilters={clearFilters}
              />

              {filteredRecordsForResponses.length === 0 ? (
                <div className='rounded-3xl bg-amber-50 px-5 py-8 text-center text-sm text-amber-700'>
                  目前篩選條件下沒有資料，請調整篩選條件後再試。
                </div>
              ) : null}

              <div className='rounded-3xl border border-rose-100'>
                <Table>
                  <TableHeader>
                    <TableRow className='border-rose-100 hover:bg-transparent'>
                      <TableHead className='whitespace-nowrap'>姓名</TableHead>
                      <CollapsibleContactColumnHead
                        label='電話'
                        expanded={showPhoneColumn}
                        onToggle={() => setShowPhoneColumn((v) => !v)}
                        icon={Phone}
                        expandLabel='展開電話欄'
                        collapseLabel='收合電話欄'
                      />
                      <TableHead>參加</TableHead>
                      <TableHead>人數</TableHead>
                      <CollapsibleContactColumnHead
                        label='Email'
                        expanded={showEmailColumn}
                        onToggle={() => setShowEmailColumn((v) => !v)}
                        icon={Mail}
                        expandLabel='展開 Email 欄'
                        collapseLabel='收合 Email 欄'
                      />
                      <TableHead>吃素</TableHead>
                      <TableHead>類別</TableHead>
                      <TableHead>關係</TableHead>
                      <TableHead>單身</TableHead>
                      <TableHead>紙帖</TableHead>
                      <TableHead className='min-w-[12rem]'>地址</TableHead>
                      <TableHead>座位</TableHead>
                      <TableHead className='min-w-[16rem]'>留言</TableHead>
                      <TableHead className='w-20 text-center'>刪除</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRecords.map((record) => (
                      <TableRow key={record.id} className='border-rose-100'>
                        <TableCell className='whitespace-nowrap font-medium text-stone-700'>
                          {record.name}
                        </TableCell>
                        <TableCell
                          className={cn(!showPhoneColumn && 'w-fit p-1')}
                        >
                          {showPhoneColumn ? (
                            <CopyableTableCell rawText={record.phone} copyLabel='複製電話' />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span
                            className='inline-flex items-center justify-center'
                            title={record.attending ? '會參加' : '無法參加'}
                          >
                            {record.attending ? (
                              <CircleCheck aria-hidden='true' className='size-4 text-emerald-600' />
                            ) : (
                              <CircleX aria-hidden='true' className='size-4 text-stone-400' />
                            )}
                            <span className='sr-only'>
                              {record.attending ? '會參加' : '無法參加'}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>{record.guestCount}</TableCell>
                        <TableCell
                          className={cn(!showEmailColumn && 'w-fit p-1')}
                        >
                          {showEmailColumn ? (
                            <CopyableTableCell rawText={record.email} copyLabel='複製電子信箱' />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {record.vegetarian === null ? (
                            '—'
                          ) : (
                            <span
                              className='inline-flex items-center justify-center'
                              title={vegetarianLabel[record.vegetarian]}
                            >
                              {record.vegetarian === 'none' ? (
                                <CircleX aria-hidden='true' className='size-4 text-stone-400' />
                              ) : (
                                <CircleCheck
                                  aria-hidden='true'
                                  className='size-4 text-emerald-600'
                                />
                              )}
                              <span className='sr-only'>{vegetarianLabel[record.vegetarian]}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <GuestSideLabel side={record.side} />
                        </TableCell>
                        <TableCell>
                          <Badge className={relationshipTagBadgeClass[record.relationshipTag]}>
                            {relationshipTagLabel[record.relationshipTag]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.isSingle === null ? (
                            '—'
                          ) : (
                            <span
                              className='inline-flex items-center justify-center'
                              title={record.isSingle ? '單身' : '非單身'}
                            >
                              {record.isSingle ? (
                                <CircleCheck
                                  aria-hidden='true'
                                  className='size-4 text-emerald-600'
                                />
                              ) : (
                                <CircleX aria-hidden='true' className='size-4 text-stone-400' />
                              )}
                              <span className='sr-only'>{record.isSingle ? '單身' : '非單身'}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className='inline-flex items-center justify-center'
                            title={record.needsPaperInvitation ? '需要' : '不需要'}
                          >
                            {record.needsPaperInvitation ? (
                              <CircleCheck aria-hidden='true' className='size-4 text-emerald-600' />
                            ) : (
                              <CircleX aria-hidden='true' className='size-4 text-stone-400' />
                            )}
                            <span className='sr-only'>
                              {record.needsPaperInvitation ? '需要' : '不需要'}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <CopyableTableCell
                            rawText={record.needsPaperInvitation ? record.mailingAddress : ''}
                            copyLabel='複製收件地址'
                          />
                        </TableCell>
                        <TableCell>
                          {record.attending ? (
                            <span
                              className='inline-flex items-center justify-center'
                              title={record.seatAssigned ? '已安排' : '未安排'}
                            >
                              {record.seatAssigned ? (
                                <CircleCheck
                                  aria-hidden='true'
                                  className='size-4 text-emerald-600'
                                />
                              ) : (
                                <span
                                  aria-hidden='true'
                                  className='inline-flex size-4 items-center justify-center text-[15px] font-semibold leading-none text-stone-500'
                                >
                                  ?
                                </span>
                              )}
                              <span className='sr-only'>
                                {record.seatAssigned ? '已安排' : '未安排'}
                              </span>
                            </span>
                          ) : (
                            '不適用'
                          )}
                        </TableCell>
                        <TableCell className='align-top'>
                          <MessageTableCell message={record.message ?? ''} />
                        </TableCell>
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
                            <Trash2 aria-hidden='true' className='size-4' />
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
        <SeatingPlannerTab
          records={localRecords}
          filteredGuestIds={filteredGuestIdsForSeating}
          onSave={handleSaveSeating}
          filtersPanel={
            <RsvpFiltersPanel
              selectedSides={selectedSides}
              selectedRelationshipTags={selectedRelationshipTags}
              selectedVegetarianStatus={selectedVegetarianStatus}
              selectedAttendingStatus={selectedAttendingStatus}
              selectedSingleStatus={selectedSingleStatus}
              selectedPaperInvitationStatus={selectedPaperInvitationStatus}
              onToggleSide={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedSides);
              }}
              onToggleRelationshipTag={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedRelationshipTags);
              }}
              onToggleVegetarianStatus={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedVegetarianStatus);
              }}
              onToggleAttendingStatus={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedAttendingStatus);
              }}
              onToggleSingleStatus={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedSingleStatus);
              }}
              onTogglePaperInvitationStatus={(value) => {
                setCurrentPage(1);
                toggleMultiSelect(value, setSelectedPaperInvitationStatus);
              }}
              onClearFilters={clearFilters}
              visibleGroups={{ attending: false }}
            />
          }
        />
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
            setNewGuestRelationshipTag('friend');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增賓客</DialogTitle>
            <DialogDescription>
              請填寫姓名、是否吃素、男方/女方與關係標籤，其餘資料會套用預設值。
            </DialogDescription>
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
                  <GuestSideLabel side='groom' variant='full' />
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
                  <GuestSideLabel side='bride' variant='full' />
                </label>
              </div>
            </div>
            <div className='space-y-1.5'>
              <p className='text-sm font-medium text-stone-700'>關係標籤</p>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-relationship-tag'
                    value='classmate'
                    checked={newGuestRelationshipTag === 'classmate'}
                    onChange={() => setNewGuestRelationshipTag('classmate')}
                    disabled={creating}
                  />
                  同學
                </label>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-relationship-tag'
                    value='colleague'
                    checked={newGuestRelationshipTag === 'colleague'}
                    onChange={() => setNewGuestRelationshipTag('colleague')}
                    disabled={creating}
                  />
                  同事
                </label>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-relationship-tag'
                    value='friend'
                    checked={newGuestRelationshipTag === 'friend'}
                    onChange={() => setNewGuestRelationshipTag('friend')}
                    disabled={creating}
                  />
                  朋友
                </label>
                <label className='flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300'>
                  <input
                    type='radio'
                    name='new-guest-relationship-tag'
                    value='relative'
                    checked={newGuestRelationshipTag === 'relative'}
                    onChange={() => setNewGuestRelationshipTag('relative')}
                    disabled={creating}
                  />
                  家人
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

const relationshipTagLabel = {
  classmate: '同學',
  colleague: '同事',
  friend: '朋友',
  relative: '家人',
} as const;

const relationshipTagBadgeClass = {
  classmate: 'whitespace-nowrap border-transparent bg-[#12CBC4] text-white',
  colleague: 'whitespace-nowrap border-transparent bg-[#1289A7] text-white',
  friend: 'whitespace-nowrap border-transparent bg-[#009432] text-white',
  relative: 'whitespace-nowrap border-transparent bg-bride text-white',
} as const;

function toggleMultiSelect<T>(value: T, setter: React.Dispatch<React.SetStateAction<T[]>>) {
  setter((prev) =>
    prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
  );
}
