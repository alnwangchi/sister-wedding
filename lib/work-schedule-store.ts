import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase";

/** 獨立集合，單一文件存放整份工作安排 */
export const WORK_SCHEDULE_COLLECTION = "work_schedule";
export const WORK_SCHEDULE_DOC_ID = "main";

export type WorkScheduleTask = { id: string; label: string };
export type WorkSchedulePerson = { id: string; name: string };

export type WorkScheduleState = {
  tasks: WorkScheduleTask[];
  people: WorkSchedulePerson[];
  taskAssignments: Record<string, string[]>;
};

function parseTasks(value: unknown): WorkScheduleTask[] {
  if (!Array.isArray(value)) return [];
  const out: WorkScheduleTask[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.label === "string") {
      const label = o.label.trim().slice(0, 64);
      if (label.length > 0) out.push({ id: o.id.slice(0, 128), label });
    }
  }
  return out;
}

function parsePeople(value: unknown): WorkSchedulePerson[] {
  if (!Array.isArray(value)) return [];
  const out: WorkSchedulePerson[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.name === "string") {
      const name = o.name.trim().slice(0, 48);
      if (name.length > 0) out.push({ id: o.id.slice(0, 128), name });
    }
  }
  return out;
}

function parseTaskAssignments(
  value: unknown,
  taskIds: Set<string>,
): Record<string, string[]> {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const tid of taskIds) {
    const list = raw[tid];
    out[tid] = Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  }
  return out;
}

function parseWorkScheduleDoc(data: Record<string, unknown>): WorkScheduleState | null {
  const tasks = parseTasks(data.tasks);
  const people = parsePeople(data.people);
  const taskIds = new Set(tasks.map((t) => t.id));
  const taskAssignments = parseTaskAssignments(data.taskAssignments, taskIds);

  return {
    tasks,
    people,
    taskAssignments,
  };
}

export async function getWorkSchedule(): Promise<WorkScheduleState | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, WORK_SCHEDULE_COLLECTION, WORK_SCHEDULE_DOC_ID));
  if (!snap.exists()) {
    return null;
  }
  const raw = snap.data();
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  return parseWorkScheduleDoc(raw as Record<string, unknown>);
}

export async function saveWorkSchedule(state: WorkScheduleState): Promise<void> {
  const db = getFirebaseDb();
  await setDoc(doc(db, WORK_SCHEDULE_COLLECTION, WORK_SCHEDULE_DOC_ID), {
    tasks: state.tasks,
    people: state.people,
    taskAssignments: state.taskAssignments,
    updatedAt: Timestamp.now(),
  });
}
