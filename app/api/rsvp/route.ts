import { NextResponse } from "next/server";

import { isFirebaseConfigured } from "@/lib/firebase";
import { createRsvp } from "@/lib/rsvp-store";
import { rsvpSchema } from "@/schemas/rsvp";

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
    const parsed = rsvpSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "表單驗證失敗",
        },
        { status: 400 },
      );
    }

    await createRsvp({
      name: parsed.data.name,
      phone: parsed.data.phone,
      attending: parsed.data.attending === "yes",
      guestCount: parsed.data.guestCount,
      email: parsed.data.email,
      vegetarian: parsed.data.vegetarian,
      side: parsed.data.side,
      relationshipTag: parsed.data.relationshipTag,
      isSingle:
        parsed.data.isSingle === "yes"
          ? true
          : parsed.data.isSingle === "no"
            ? false
            : null,
      needsPaperInvitation: parsed.data.needsPaperInvitation === "yes",
      mailingAddress: parsed.data.mailingAddress,
      message: parsed.data.message,
      seatAssigned: false,
      seatOrder: null,
      seatPosition: null,
      seatSlots: null,
      seatingTableCount: null,
      seatingTablePositions: null,
      seatingTableNames: null,
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
