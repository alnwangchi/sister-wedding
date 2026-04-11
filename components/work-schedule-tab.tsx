'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import { Button } from '@/components/ui/button';
import type { WorkScheduleState } from '@/lib/work-schedule-store';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'wedding-rsvp-work-schedule';

const PRESET_TASKS = [
  { id: 'task-preset-gift', label: '收禮金' },
  { id: 'task-preset-guide', label: '帶位人員' },
  { id: 'task-preset-greet', label: '門口迎賓' },
  { id: 'task-preset-cookie', label: '喜餅發放' },
  { id: 'task-preset-photo', label: '攝影' },
] as const;

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
}

function defaultState(): WorkScheduleState {
  return {
    tasks: PRESET_TASKS.map((t) => ({ id: t.id, label: t.label })),
    people: [],
    taskAssignments: Object.fromEntries(PRESET_TASKS.map((t) => [t.id, [] as string[]])),
  };
}

/** 確保每個工作 id 在 taskAssignments 都有一筆，並移除孤兒鍵 */
function ensureAssignments(state: WorkScheduleState): WorkScheduleState {
  const taskAssignments = { ...state.taskAssignments };
  for (const t of state.tasks) {
    if (!Array.isArray(taskAssignments[t.id])) {
      taskAssignments[t.id] = [];
    }
  }
  for (const key of Object.keys(taskAssignments)) {
    if (!state.tasks.some((x) => x.id === key)) {
      delete taskAssignments[key];
    }
  }
  return { ...state, taskAssignments };
}

function parseStored(raw: string | null): WorkScheduleState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    if (!Array.isArray(o.tasks) || !Array.isArray(o.people) || typeof o.taskAssignments !== 'object') {
      return null;
    }
    const tasks: WorkScheduleState['tasks'] = [];
    for (const item of o.tasks) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      if (typeof t.id === 'string' && typeof t.label === 'string' && t.label.trim()) {
        tasks.push({ id: t.id, label: t.label.trim() });
      }
    }
    const people: WorkScheduleState['people'] = [];
    for (const item of o.people) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      if (typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim()) {
        people.push({ id: p.id, name: p.name.trim() });
      }
    }
    const taskAssignments: Record<string, string[]> = {};
    const ta = o.taskAssignments as Record<string, unknown>;
    for (const task of tasks) {
      const list = ta[task.id];
      taskAssignments[task.id] = Array.isArray(list)
        ? list.filter((id): id is string => typeof id === 'string')
        : [];
    }
    return { tasks, people, taskAssignments };
  } catch {
    return null;
  }
}

const POOL_DROP_ID = 'work-schedule-pool';

function DraggablePersonChip({
  personId,
  name,
  source,
}: {
  personId: string;
  name: string;
  source: 'pool' | string;
}) {
  const dragId = `ws-drag-${personId}-${source}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { personId, source },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex cursor-grab touch-none items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 shadow-sm select-none active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <span
        {...listeners}
        {...attributes}
        className='flex items-center gap-1 text-stone-400'
        aria-hidden='true'
      >
        <GripVertical className='size-3.5 shrink-0' />
      </span>
      <span className='min-w-0 truncate'>{name}</span>
    </div>
  );
}

function TaskDropZone({
  taskId,
  label,
  onRemove,
  children,
}: {
  taskId: string;
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const dropId = `ws-task-${taskId}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border-2 border-dashed p-4 transition-colors',
        isOver ? 'border-rose-400 bg-rose-50/60' : 'border-rose-100 bg-white/80',
      )}
    >
      <div className='mb-3 flex items-start justify-between gap-2'>
        <h3 className='text-sm font-semibold text-stone-800'>{label}</h3>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8 shrink-0 text-stone-400 hover:text-rose-600'
          onClick={onRemove}
          title='移除此工作項目'
        >
          <Trash2 aria-hidden='true' className='size-4' />
          <span className='sr-only'>移除 {label}</span>
        </Button>
      </div>
      <div className='flex min-h-[4.5rem] flex-wrap gap-2'>{children}</div>
    </div>
  );
}

function PoolDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border-2 border-dashed p-4 transition-colors',
        isOver ? 'border-sky-400 bg-sky-50/50' : 'border-stone-200 bg-stone-50/50',
      )}
    >
      <p className='mb-3 text-sm font-medium text-stone-600'>尚未分配的人員</p>
      <div className='flex min-h-[3rem] flex-wrap gap-2'>{children}</div>
    </div>
  );
}

export function WorkScheduleTab({ usingMockData }: { usingMockData: boolean }) {
  const [state, setState] = useState<WorkScheduleState>(() => defaultState());
  const [hydrated, setHydrated] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [activeDrag, setActiveDrag] = useState<{ personId: string; name: string } | null>(null);
  const skipCloudPersistRef = useRef(true);

  useEffect(() => {
    if (usingMockData) {
      const loaded = parseStored(window.localStorage.getItem(STORAGE_KEY));
      setState(loaded ? ensureAssignments(loaded) : defaultState());
      setHydrated(true);
      return;
    }

    let cancelled = false;

    async function loadFromCloud() {
      try {
        const res = await fetch('/api/rsvp/work-schedule');
        const json = (await res.json()) as {
          data?: WorkScheduleState | null;
          message?: string;
        };

        if (cancelled) return;

        if (res.ok) {
          if (json.data === null || json.data === undefined) {
            const fromLocal = parseStored(window.localStorage.getItem(STORAGE_KEY));
            if (fromLocal) {
              const fixed = ensureAssignments(fromLocal);
              setState(fixed);
              void fetch('/api/rsvp/work-schedule', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fixed),
              }).catch(() => {
                toast.error('本機備份無法同步至雲端');
              });
            } else {
              setState(defaultState());
            }
          } else {
            setState(ensureAssignments(json.data));
          }
        } else {
          throw new Error(json.message ?? '讀取失敗');
        }
      } catch {
        if (!cancelled) {
          toast.error('無法從雲端載入工作安排，已改用本機備份。');
          const fromLocal = parseStored(window.localStorage.getItem(STORAGE_KEY));
          setState(fromLocal ? ensureAssignments(fromLocal) : defaultState());
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          queueMicrotask(() => {
            skipCloudPersistRef.current = false;
          });
        }
      }
    }

    void loadFromCloud();
    return () => {
      cancelled = true;
    };
  }, [usingMockData]);

  useEffect(() => {
    if (!hydrated) return;

    if (usingMockData) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore quota
      }
      return;
    }

    if (skipCloudPersistRef.current) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/rsvp/work-schedule', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          });
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          if (!res.ok) {
            throw new Error(payload?.message ?? '儲存失敗');
          }
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          } catch {
            // ignore quota
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '無法同步至雲端';
          toast.error(message);
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [state, hydrated, usingMockData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const personById = useMemo(() => new Map(state.people.map((p) => [p.id, p])), [state.people]);

  const assignedSet = useMemo(() => {
    const s = new Set<string>();
    for (const ids of Object.values(state.taskAssignments)) {
      for (const id of ids) s.add(id);
    }
    return s;
  }, [state.taskAssignments]);

  const unassignedPeople = useMemo(
    () => state.people.filter((p) => !assignedSet.has(p.id)),
    [state.people, assignedSet],
  );

  const addTask = useCallback(() => {
    const label = newTaskLabel.trim();
    if (!label) {
      toast.error('請輸入工作項目名稱');
      return;
    }
    const id = newId('task');
    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id, label }],
      taskAssignments: { ...prev.taskAssignments, [id]: [] },
    }));
    setNewTaskLabel('');
    toast.success('已新增工作項目');
  }, [newTaskLabel]);

  const removeTask = useCallback((taskId: string) => {
    setState((prev) => {
      const nextTasks = prev.tasks.filter((t) => t.id !== taskId);
      const { [taskId]: _removed, ...restAssignments } = prev.taskAssignments;
      return {
        ...prev,
        tasks: nextTasks,
        taskAssignments: restAssignments,
      };
    });
  }, []);

  const addPerson = useCallback(() => {
    const name = newPersonName.trim();
    if (!name) {
      toast.error('請輸入姓名');
      return;
    }
    const id = newId('person');
    setState((prev) => ({
      ...prev,
      people: [...prev.people, { id, name }],
    }));
    setNewPersonName('');
    toast.success('已新增人員');
  }, [newPersonName]);

  const removePerson = useCallback((personId: string) => {
    setState((prev) => {
      const nextAssignments: Record<string, string[]> = {};
      for (const [tid, ids] of Object.entries(prev.taskAssignments)) {
        nextAssignments[tid] = ids.filter((id) => id !== personId);
      }
      return {
        ...prev,
        people: prev.people.filter((p) => p.id !== personId),
        taskAssignments: nextAssignments,
      };
    });
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { personId?: unknown } | undefined;
    const personId = typeof data?.personId === 'string' ? data.personId : null;
    if (!personId) return;
    const person = personById.get(personId);
    if (person) setActiveDrag({ personId, name: person.name });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;

    const data = active.data.current as { personId?: unknown; source?: unknown } | undefined;
    const personId = typeof data?.personId === 'string' ? data.personId : null;
    if (!personId) return;

    const overId = String(over.id);

    setState((prev) => {
      const nextAssignments: Record<string, string[]> = {};
      for (const [tid, ids] of Object.entries(prev.taskAssignments)) {
        nextAssignments[tid] = ids.filter((id) => id !== personId);
      }

      if (overId === POOL_DROP_ID) {
        return { ...prev, taskAssignments: nextAssignments };
      }

      const taskPrefix = 'ws-task-';
      if (overId.startsWith(taskPrefix)) {
        const taskId = overId.slice(taskPrefix.length);
        if (!prev.tasks.some((t) => t.id === taskId)) return prev;
        const current = nextAssignments[taskId] ?? [];
        if (current.includes(personId)) return prev;
        nextAssignments[taskId] = [...current, personId];
        return { ...prev, taskAssignments: nextAssignments };
      }

      return prev;
    });
  }

  if (!hydrated) {
    return (
      <section className='rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
        <p className='text-sm text-stone-500'>載入中…</p>
      </section>
    );
  }

  return (
    <section className='space-y-6 rounded-[2rem] border border-rose-100 bg-white/90 p-6 shadow-sm'>
      <div className='space-y-1'>
        <h2 className='text-lg font-semibold text-stone-800'>工作安排</h2>
        <p className='text-sm text-stone-500'>
          新增工作項目與人員後，將人員拖曳至對應工作區；拖回下方區域可取消分配。
          {usingMockData ? null : (
            <span className='mt-1 block'>變更會自動同步至 Firestore（集合 work_schedule）。</span>
          )}
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
          <div className='space-y-4'>
            <div className='rounded-2xl border border-rose-100 bg-rose-50/30 p-4'>
              <p className='mb-3 text-sm font-medium text-stone-700'>新增工作項目</p>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <input
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  placeholder='例如：音控'
                  maxLength={32}
                  className='min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200'
                />
                <Button type='button' onClick={addTask} className='shrink-0 gap-1.5'>
                  <Plus aria-hidden='true' className='size-4' />
                  新增
                </Button>
              </div>
            </div>

            <div className='rounded-2xl border border-rose-100 bg-rose-50/30 p-4'>
              <p className='mb-3 text-sm font-medium text-stone-700'>新增人員</p>
              <div className='flex flex-col gap-2 sm:flex-row'>
                <input
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPerson();
                    }
                  }}
                  placeholder='姓名'
                  maxLength={24}
                  className='min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200'
                />
                <Button type='button' onClick={addPerson} className='shrink-0 gap-1.5'>
                  <Plus aria-hidden='true' className='size-4' />
                  新增
                </Button>
              </div>
            </div>

            <PoolDropZone>
              {unassignedPeople.length === 0 ? (
                <p className='text-sm text-stone-400'>尚無未分配人員（請先新增人員）</p>
              ) : (
                unassignedPeople.map((p) => (
                  <div key={p.id} className='group relative'>
                    <DraggablePersonChip personId={p.id} name={p.name} source='pool' />
                    <button
                      type='button'
                      onClick={() => removePerson(p.id)}
                      className='absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-stone-200 text-stone-600 opacity-0 transition hover:bg-rose-100 hover:text-rose-700 group-hover:opacity-100'
                      title='刪除此人員'
                    >
                      <Trash2 aria-hidden='true' className='size-3' />
                      <span className='sr-only'>刪除 {p.name}</span>
                    </button>
                  </div>
                ))
              )}
            </PoolDropZone>
          </div>

          <div className='space-y-4'>
            <p className='text-sm font-medium text-stone-700'>工作區域</p>
            <div className='grid gap-4 sm:grid-cols-1'>
              {state.tasks.length === 0 ? (
                <p className='rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-8 text-center text-sm text-stone-500'>
                  尚無工作項目，請在左側新增。
                </p>
              ) : null}
              {state.tasks.map((task) => {
                const assignedIds = state.taskAssignments[task.id] ?? [];
                return (
                  <TaskDropZone
                    key={task.id}
                    taskId={task.id}
                    label={task.label}
                    onRemove={() => removeTask(task.id)}
                  >
                    {assignedIds.length === 0 ? (
                      <span className='self-center text-sm text-stone-400'>將人員拖曳到此處</span>
                    ) : (
                      assignedIds.map((pid) => {
                        const p = personById.get(pid);
                        if (!p) return null;
                        return (
                          <div key={pid} className='group relative'>
                            <DraggablePersonChip
                              personId={p.id}
                              name={p.name}
                              source={task.id}
                            />
                            <button
                              type='button'
                              onClick={() => removePerson(p.id)}
                              className='absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-stone-200 text-stone-600 opacity-0 transition hover:bg-rose-100 hover:text-rose-700 group-hover:opacity-100'
                              title='刪除此人員'
                            >
                              <Trash2 aria-hidden='true' className='size-3' />
                              <span className='sr-only'>刪除 {p.name}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </TaskDropZone>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className='flex cursor-grabbing items-center gap-1 rounded-full border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-lg'>
              <GripVertical aria-hidden='true' className='size-3.5 text-stone-400' />
              {activeDrag.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
