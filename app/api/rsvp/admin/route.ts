import { NextResponse } from "next/server";
import { z } from "zod";

import { isFirebaseConfigured } from "@/lib/firebase";
import { createRsvp } from "@/lib/rsvp-store";

const adminCreateSchema = z.object({
  name: z.string().trim().min(1, "請輸入姓名").max(12, "姓名上限為 12 字"),
  vegetarian: z.boolean().default(false),
  side: z.enum(["groom", "bride"], {
    error: "請選擇男方或女方",
  }),
});

export async function POST(request: Request) {
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
    const parsed = adminCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "表單驗證失敗",
        },
        { status: 400 },
      );
    }

    const createdId = await createRsvp({
      name: parsed.data.name,
      phone: "",
      attending: true,
      guestCount: 0,
      email: "",
      vegetarian: parsed.data.vegetarian ? "vegetarian" : "none",
      side: parsed.data.side,
      message: "",
      seatAssigned: false,
    });

    return NextResponse.json({
      message: "success",
      record: {
        id: createdId,
        name: parsed.data.name,
        phone: "",
        attending: true,
        guestCount: 0,
        email: "",
        vegetarian: parsed.data.vegetarian ? "vegetarian" : "none",
        side: parsed.data.side,
        message: "",
        seatAssigned: false,
        createdAt: new Date().toISOString(),
      },
    });
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
