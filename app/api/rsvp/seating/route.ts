import { NextResponse } from "next/server";
import { z } from "zod";

import { isFirebaseConfigured } from "@/lib/firebase";
import { saveSeatingAssignments } from "@/lib/rsvp-store";

const seatAssignmentSchema = z.object({
  id: z.string().trim().min(1, "賓客 id 不可為空"),
  seatOrder: z.number().int().min(1, "座位順序需從 1 開始"),
  seatPosition: z.string().trim().min(1, "座位位置不可為空"),
});

const saveSeatingSchema = z.object({
  assignments: z.array(seatAssignmentSchema),
});

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

    await saveSeatingAssignments(parsed.data.assignments);

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
