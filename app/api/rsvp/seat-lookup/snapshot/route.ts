import { NextResponse } from 'next/server';

import { isFirebaseConfigured } from '@/lib/firebase';
import { getPublicSeatLookupSnapshot } from '@/lib/rsvp-store';
import { isJulyInTaipei } from '@/lib/wedding-season';

export async function GET() {
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

    const snapshot = await getPublicSeatLookupSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    return NextResponse.json({ message }, { status: 500 });
  }
}
