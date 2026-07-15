/** 桌名是否包含指定場地桌號（避免 2 誤配 22） */
export function tableNameMatchesNumber(name: string, tableNumber: number): boolean {
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    return false;
  }

  const normalized = name.replace(/\s+/g, '');
  const arabicNumberPattern = new RegExp(`(^|\\D)${tableNumber}(\\D|$)`);
  const chineseNumber = chineseTableNumber(tableNumber);

  return (
    arabicNumberPattern.test(normalized) ||
    (chineseNumber.length > 0 && normalized.includes(chineseNumber))
  );
}

/**
 * 將賓客面向的場地桌號解析為系統 0-based tableIndex。
 * 優先匹配自訂桌名中的桌號（如「周國樑 22桌」），找不到再回退陣列下標。
 */
export function resolveTableIndexByNumber(
  tableNames: readonly string[] | null | undefined,
  tableNumber: number,
  tableCount: number,
): number | null {
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > tableCount) {
    return null;
  }

  if (tableNames && tableNames.length > 0) {
    const byName = tableNames.findIndex((name) =>
      tableNameMatchesNumber(name, tableNumber),
    );
    if (byName >= 0 && byName < tableCount) {
      return byName;
    }
  }

  return tableNumber - 1;
}

function chineseTableNumber(tableNumber: number): string {
  // 目前場地自訂名以阿拉伯數字為主；海關桌仍可能用「十五／十六」
  if (tableNumber === 15) return '十五';
  if (tableNumber === 16) return '十六';
  return '';
}
