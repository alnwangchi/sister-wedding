import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase";
import type { CreateRsvpInput, RsvpRecord } from "@/types/rsvp";

const COLLECTION_NAME = "rsvps";

export async function createRsvp(input: CreateRsvpInput) {
  const db = getFirebaseDb();
  const payload = {
    ...input,
    createdAt: Timestamp.now(),
  };

  await addDoc(collection(db, COLLECTION_NAME), payload);
}

export async function listRsvps(): Promise<RsvpRecord[]> {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc")),
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString();

    return {
      id: doc.id,
      name: String(data.name ?? ""),
      phone: String(data.phone ?? ""),
      attending: Boolean(data.attending),
      guestCount: Number(data.guestCount ?? 0),
      email: String(data.email ?? ""),
      vegetarian: (data.vegetarian ?? null) as RsvpRecord["vegetarian"],
      side: (data.side ?? "groom") as RsvpRecord["side"],
      message: String(data.message ?? ""),
      needEDM: Boolean(data.needEDM),
      seatAssigned: Boolean(data.seatAssigned),
      createdAt,
    };
  });
}

export async function deleteRsvp(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
