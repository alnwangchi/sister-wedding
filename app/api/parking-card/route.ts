import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "assets", "parking_card.pdf");
    const fileBuffer = await readFile(filePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="parking_card.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      {
        message: "找不到停車卡檔案",
      },
      { status: 404 },
    );
  }
}
