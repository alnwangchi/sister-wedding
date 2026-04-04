import { NextResponse } from "next/server";
import { z } from "zod";

import { isFirebaseConfigured } from "@/lib/firebase";
import { saveSeatingAssignments } from "@/lib/rsvp-store";

const seatAssignmentSchema = z.object({
  id: z.string().trim().min(1, "賓客 id 不可為空"),
  seatOrder: z.number().int().min(1, "座位順序需從 1 開始"),
  seatPosition: z.string().trim().min(1, "座位位置不可為空"),
});

const tablePositionSchema = z.object({
  x: z.number().finite("桌位 X 座標格式錯誤"),
  y: z.number().finite("桌位 Y 座標格式錯誤"),
});

const saveSeatingSchema = z.object({
  assignments: z.array(seatAssignmentSchema),
  tableCount: z.number().int().min(1, "桌數需至少 1 桌"),
  tablePositions: z.array(tablePositionSchema),
  tableNames: z.array(z.string().max(40, "單桌名稱上限 40 字")).optional(),
});

function normalizeTablePositions(
  tablePositions: Array<{ x: number; y: number }>,
  tableCount: number,
) {
  if (tablePositions.length === tableCount) {
    return tablePositions;
  }

  if (tablePositions.length > tableCount) {
    return tablePositions.slice(0, tableCount);
  }

  return [
    ...tablePositions,
    ...Array.from({ length: tableCount - tablePositions.length }, () => ({ x: 0, y: 0 })),
  ];
}

function normalizeTableNames(
  tableNames: string[] | undefined,
  tableCount: number,
): string[] {
  const defaults = Array.from({ length: tableCount }, (_, i) => `第 ${i + 1} 桌`);
  if (!tableNames || tableNames.length === 0) {
    return defaults;
  }

  const cleaned = tableNames.map((raw, i) => {
    const t = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
    return t.length > 0 ? t : defaults[i] ?? `第 ${i + 1} 桌`;
  });

  if (cleaned.length === tableCount) {
    return cleaned;
  }

  if (cleaned.length > tableCount) {
    return cleaned.slice(0, tableCount);
  }

  return [...cleaned, ...defaults.slice(cleaned.length)];
}

export async function PUT(request: Request) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        {
          message: "Firebase 尚未設定完成，請先補上環境變數。",
        },
        { status: 500 },
      );
    }

    const json = await request.json();
    const parsed = saveSeatingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "座位資料驗證失敗",
        },
        { status: 400 },
      );
    }

    const tableCount = parsed.data.tableCount;
    await saveSeatingAssignments(parsed.data.assignments, {
      tableCount,
      tablePositions: normalizeTablePositions(parsed.data.tablePositions, tableCount),
      tableNames: normalizeTableNames(parsed.data.tableNames, tableCount),
    });

    return NextResponse.json({ message: "success" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        message,
      },
      { status: 500 },
    );
  }
}
