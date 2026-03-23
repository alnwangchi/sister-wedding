import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase";
import type { CreateRsvpInput, RsvpRecord } from "@/types/rsvp";

const COLLECTION_NAME = "rsvps";

function parseTablePositions(
  value: unknown,
): Array<{ x: number; y: number }> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.x === "number" &&
      Number.isFinite(candidate.x) &&
      typeof candidate.y === "number" &&
      Number.isFinite(candidate.y)
    ) {
      return [{ x: candidate.x, y: candidate.y }];
    }
    return [];
  });

  return parsed;
}

export async function createRsvp(input: CreateRsvpInput) {
  const db = getFirebaseDb();
  const payload = {
    ...input,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return docRef.id;
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
      relationshipTag: (data.relationshipTag ?? "friend") as RsvpRecord["relationshipTag"],
      message: String(data.message ?? ""),
      seatAssigned: Boolean(data.seatAssigned),
      seatOrder: typeof data.seatOrder === "number" ? data.seatOrder : null,
      seatPosition: typeof data.seatPosition === "string" ? data.seatPosition : null,
      seatingTableCount:
        typeof data.seatingTableCount === "number" && Number.isFinite(data.seatingTableCount)
          ? data.seatingTableCount
          : null,
      seatingTablePositions: parseTablePositions(data.seatingTablePositions),
      createdAt,
    };
  });
}

export async function deleteRsvp(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function saveSeatingAssignments(
  assignments: Array<{ id: string; seatOrder: number; seatPosition: string }>,
  seatingLayout: {
    tableCount: number;
    tablePositions: Array<{ x: number; y: number }>;
  },
) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const assignmentMap = new Map(assignments.map((item) => [item.id, item]));
  const batch = writeBatch(db);

  snapshot.docs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const assignment = assignmentMap.get(snapshotDoc.id);
    const isAttending = Boolean(data.attending);

    if (assignment && isAttending) {
      batch.update(snapshotDoc.ref, {
        seatAssigned: true,
        seatOrder: assignment.seatOrder,
        seatPosition: assignment.seatPosition,
        seatingTableCount: seatingLayout.tableCount,
        seatingTablePositions: seatingLayout.tablePositions,
      });
      return;
    }

    const hasAssignedSeat =
      Boolean(data.seatAssigned) ||
      typeof data.seatOrder === "number" ||
      typeof data.seatPosition === "string";

    if (hasAssignedSeat) {
      batch.update(snapshotDoc.ref, {
        seatAssigned: false,
        seatOrder: null,
        seatPosition: null,
        seatingTableCount: seatingLayout.tableCount,
        seatingTablePositions: seatingLayout.tablePositions,
      });
      return;
    }

    batch.update(snapshotDoc.ref, {
      seatingTableCount: seatingLayout.tableCount,
      seatingTablePositions: seatingLayout.tablePositions,
    });
  });

  await batch.commit();
}
