import { NextResponse } from 'next/server';

import { isFirebaseConfigured } from '@/lib/firebase';
import { lookupGuestSeats } from '@/lib/rsvp-store';
import { isJulyInTaipei } from '@/lib/wedding-season';

export async function GET(request: Request) {
  try {
    if (!isJulyInTaipei()) {
      return NextResponse.json(
        { message: '座位查詢僅於七月開放。' },
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
    const q = (searchParams.get('q') ?? '').trim();
    if (q.length < 1) {
      return NextResponse.json({ message: '請輸入姓名或電話。' }, { status: 400 });
    }

    const results = await lookupGuestSeats(q);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ message }, { status: 500 });
  }
}
