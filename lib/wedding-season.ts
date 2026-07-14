/** 以台北時區判斷目前是否為七月（婚宴當月改為座位查詢） */
export function isJulyInTaipei(date = new Date()): boolean {
  const month = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      month: 'numeric',
    }).format(date),
  );
  return month === 7;
}
