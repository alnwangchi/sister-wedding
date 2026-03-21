import type { RsvpRecord } from "@/types/rsvp";

const lastNames = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊"];
const firstNames = ["怡君", "冠廷", "品妤", "宇翔", "雅婷", "柏翰", "欣妍", "承恩", "書涵", "子恩"];
const messages = [
  "期待一起見證幸福時刻！",
  "先祝新婚愉快，我們當天見。",
  "謝謝邀請，已經把日期留下來了。",
  "會準時到，想吃喜酒很久了。",
  "祝福兩位永浴愛河。",
  "當天會帶家人一起出席。",
];

export const mockRsvps: RsvpRecord[] = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1;
  const attending = index % 6 !== 0;
  const guestCount = attending ? (index % 3) + 1 : 0;

  return {
    id: `mock-${number}`,
    name: `${lastNames[index % lastNames.length]}${firstNames[index % firstNames.length]}`,
    phone: `09${String(12000000 + number).padStart(8, "0")}`,
    attending,
    guestCount,
    email: `guest${String(number).padStart(2, "0")}@example.com`,
    vegetarian: attending ? (["none", "vegetarian", "vegan", "other"] as const)[index % 4] : null,
    side: index % 2 === 0 ? "groom" : "bride",
    message: attending ? messages[index % messages.length] : "當天另有行程，但先送上祝福。",
    needEDM: index % 3 === 0,
    seatAssigned: attending && index % 5 === 0,
    createdAt: new Date(Date.UTC(2026, 2, 30 - index, 10, index % 60)).toISOString(),
  };
});
