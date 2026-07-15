import { resolveTableIndexByNumber } from '@/lib/seating-table-number';

export const PUBLIC_TABLE_CAPACITY = 10;

export type SeatLookupResult = {
  name: string;
  seats: string[];
};

export type TableLookupSeat = {
  seatNumber: number;
  guestName: string | null;
};

export type TableLookupResult = {
  tableNumber: number;
  tableName: string;
  seats: TableLookupSeat[];
};

export type PublicSeatLookupGuest = {
  name: string;
  phoneDigits: string;
  seats: string[];
};

export type PublicSeatLookupTable = {
  tableName: string;
  seats: TableLookupSeat[];
};

/** 公開查詢用整包座位資料（與座位安排頁對齊） */
export type PublicSeatLookupSnapshot = {
  tableCount: number;
  tableNames: string[];
  tables: PublicSeatLookupTable[];
  guests: PublicSeatLookupGuest[];
};

function normalizeNameForLookup(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** 依姓名（部分符合）或電話（至少 4 碼數字部分符合） */
export function searchGuestsInSnapshot(
  snapshot: PublicSeatLookupSnapshot,
  query: string,
): SeatLookupResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return [];
  }

  const nameQuery = normalizeNameForLookup(trimmed);
  const phoneQuery = normalizePhoneDigits(trimmed);

  return snapshot.guests
    .filter((guest) => {
      const nameMatch =
        nameQuery.length >= 1 && normalizeNameForLookup(guest.name).includes(nameQuery);
      const phoneMatch =
        phoneQuery.length >= 4 && guest.phoneDigits.includes(phoneQuery);
      return nameMatch || phoneMatch;
    })
    .map((guest) => ({
      name: guest.name,
      seats: guest.seats,
    }))
    .slice(0, 20);
}

/** 依場地桌號查詢整桌（優先匹配自訂桌名中的數字） */
export function lookupTableInSnapshot(
  snapshot: PublicSeatLookupSnapshot,
  tableNumber: number,
): TableLookupResult | null {
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    return null;
  }

  const tableIndex = resolveTableIndexByNumber(
    snapshot.tableNames,
    tableNumber,
    snapshot.tableCount,
  );
  if (tableIndex === null) {
    return null;
  }

  const table = snapshot.tables[tableIndex];
  if (!table) {
    return null;
  }

  return {
    tableNumber,
    tableName: table.tableName,
    seats: table.seats,
  };
}

export function emptyTableSeats(capacity = PUBLIC_TABLE_CAPACITY): TableLookupSeat[] {
  return Array.from({ length: capacity }, (_, index) => ({
    seatNumber: index + 1,
    guestName: null,
  }));
}
