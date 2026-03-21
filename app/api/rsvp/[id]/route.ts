import { NextResponse } from "next/server";

import { isFirebaseConfigured } from "@/lib/firebase";
import { deleteRsvp } from "@/lib/rsvp-store";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        {
          message: "Firebase 尚未設定完成，請先補上環境變數。",
        },
        { status: 500 },
      );
    }

    const { id } = await Promise.resolve(context.params);
    if (!id) {
      return NextResponse.json(
        {
          message: "缺少要刪除的 RSVP id。",
        },
        { status: 400 },
      );
    }

    await deleteRsvp(id);

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
