import { NextResponse } from "next/server";
import { z } from "zod";

import { isFirebaseConfigured } from "@/lib/firebase";
import { getWorkSchedule, saveWorkSchedule } from "@/lib/work-schedule-store";

const taskSchema = z.object({
  id: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(64),
});

const personSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(48),
});

const saveSchema = z
  .object({
    tasks: z.array(taskSchema).max(80),
    people: z.array(personSchema).max(200),
    taskAssignments: z.record(z.string(), z.array(z.string().min(1)).max(100)),
  })
  .superRefine((data, ctx) => {
    const taskIds = new Set(data.tasks.map((t) => t.id));
    for (const id of taskIds) {
      if (!(id in data.taskAssignments)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "taskAssignments 須包含每個工作項目的 id",
          path: ["taskAssignments"],
        });
        return;
      }
    }
    for (const key of Object.keys(data.taskAssignments)) {
      if (!taskIds.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "taskAssignments 含有多餘的工作 id",
          path: ["taskAssignments", key],
        });
        return;
      }
    }
  });

export async function GET() {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { message: "Firebase 尚未設定完成。", data: null },
        { status: 500 },
      );
    }

    const data = await getWorkSchedule();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取失敗";
    return NextResponse.json({ message, data: null }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { message: "Firebase 尚未設定完成。" },
        { status: 500 },
      );
    }

    const json = await request.json();
    const parsed = saveSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "資料驗證失敗" },
        { status: 400 },
      );
    }

    const personIds = new Set(parsed.data.people.map((p) => p.id));
    for (const ids of Object.values(parsed.data.taskAssignments)) {
      for (const pid of ids) {
        if (!personIds.has(pid)) {
          return NextResponse.json(
            { message: "分配含有不存在的人員 id" },
            { status: 400 },
          );
        }
      }
    }

    await saveWorkSchedule(parsed.data);
    return NextResponse.json({ message: "success" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";
    return NextResponse.json({ message }, { status: 500 });
  }
}
