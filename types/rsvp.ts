export type AttendanceSide = "groom" | "bride";
export type VegetarianOption = "none" | "vegetarian" | "vegan" | "other";

export type RsvpRecord = {
  id: string;
  name: string;
  phone: string;
  attending: boolean;
  guestCount: number;
  email: string;
  vegetarian: VegetarianOption | null;
  side: AttendanceSide;
  message: string;
  seatAssigned: boolean;
  createdAt: string;
};

export type CreateRsvpInput = Omit<RsvpRecord, "id" | "createdAt">;
