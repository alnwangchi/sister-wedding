export type AttendanceSide = "groom" | "bride";
export type VegetarianOption = "none" | "vegetarian" | "vegan" | "other";
export type RelationshipTag = "classmate" | "colleague" | "friend";

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
  isSingle: boolean;
  needsPaperInvitation: boolean;
  mailingAddress: string;
  message: string;
  seatAssigned: boolean;
  seatOrder: number | null;
  seatPosition: string | null;
  seatingTableCount: number | null;
  seatingTablePositions: Array<{ x: number; y: number }> | null;
  createdAt: string;
};

export type CreateRsvpInput = Omit<RsvpRecord, "id" | "createdAt">;
