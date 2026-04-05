export type AttendanceSide = "groom" | "bride";
export type VegetarianOption = "none" | "vegetarian" | "vegan" | "other";
export type RelationshipTag = "classmate" | "colleague" | "friend" | "relative";

export type RsvpRecord = {
  id: string;
  name: string;
  phone: string;
  attending: boolean;
  guestCount: number;
  email: string;
  vegetarian: VegetarianOption | null;
  side: AttendanceSide;
  relationshipTag: RelationshipTag;
  /** null 表示來賓未填寫 */
  isSingle: boolean | null;
  needsPaperInvitation: boolean;
  mailingAddress: string;
  message: string;
  seatAssigned: boolean;
  seatOrder: number | null;
  seatPosition: string | null;
  /** 同一筆 RSVP 多個座位時使用；舊資料僅有 seatOrder／seatPosition 單筆 */
  seatSlots: Array<{ seatOrder: number; seatPosition: string }> | null;
  seatingTableCount: number | null;
  seatingTablePositions: Array<{ x: number; y: number }> | null;
  /** 與 seatingTableCount 對齊的每桌顯示名稱，存於每筆 RSVP 文件中並保持一致 */
  seatingTableNames: string[] | null;
  createdAt: string;
};

export type CreateRsvpInput = Omit<RsvpRecord, "id" | "createdAt">;
