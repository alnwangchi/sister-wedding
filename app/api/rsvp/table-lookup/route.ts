import { NextResponse } from 'next/server';

import { isFirebaseConfigured } from '@/lib/firebase';
import { lookupTableByNumber } from '@/lib/rsvp-store';
import { isJulyInTaipei } from '@/lib/wedding-season';

export async function GET(request: Request) {
  try {
    if (!isJulyInTaipei()) {
      return NextResponse.json(
        { message: '桌次查詢僅於七月開放。' },
        { status: 403 },
      );
    }

    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { message: 'Firebase 尚未設定完成，請先補上環境變數。' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get('n') ?? searchParams.get('q') ?? '').trim();
    const tableNumber = Number.parseInt(raw, 10);

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      return NextResponse.json({ message: '請輸入有效的桌號。' }, { status: 400 });
    }

    const result = await lookupTableByNumber(tableNumber);
    if (!result) {
      return NextResponse.json({ message: '找不到此桌號。' }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ message }, { status: 500 });
  }
}
