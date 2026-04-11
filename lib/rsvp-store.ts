import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase";
import type { CreateRsvpInput, RsvpRecord, SeatingTableCategory } from "@/types/rsvp";

const COLLECTION_NAME = "rsvps";
const SEATING_META_REF = ["meta", "seating"] as const;

type SeatingLayoutMeta = {
  tableCount: number;
  tablePositions: Array<{ x: number; y: number }>;
  tableNames: string[];
  tableCategories: SeatingTableCategory[];
};

function parseTableCategories(
  value: unknown,
  tableCount: number,
): SeatingTableCategory[] {
  const defaults = (): SeatingTableCategory[] =>
    Array.from({ length: tableCount }, () => "other");
  if (!Array.isArray(value)) {
    return defaults();
  }

  const allowed = new Set<SeatingTableCategory>(["groom", "bride", "other"]);
  const parsed = value.flatMap((item): SeatingTableCategory[] => {
    if (typeof item === "string" && allowed.has(item as SeatingTableCategory)) {
      return [item as SeatingTableCategory];
    }
    return [];
  });

  if (parsed.length === tableCount) {
    return parsed;
  }
  if (parsed.length > tableCount) {
    return parsed.slice(0, tableCount);
  }
  return [...parsed, ...defaults().slice(parsed.length)];
}

function parseSeatingMetaDoc(data: Record<string, unknown>): SeatingLayoutMeta | null {
  const tableCount = data.tableCount;
  if (typeof tableCount !== "number" || !Number.isFinite(tableCount) || tableCount < 1) {
    return null;
  }

  const tablePositions = parseTablePositions(data.tablePositions);
  const tableNames = parseTableNames(data.tableNames);
  if (!tablePositions || tablePositions.length === 0 || !tableNames || tableNames.length === 0) {
    return null;
  }

  const tableCategories = parseTableCategories(data.tableCategories, tableCount);

  return { tableCount, tablePositions, tableNames, tableCategories };
}

async function fetchSeatingLayoutMeta(): Promise<SeatingLayoutMeta | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, ...SEATING_META_REF));
  if (!snap.exists()) {
    return null;
  }
  const raw = snap.data();
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  return parseSeatingMetaDoc(raw as Record<string, unknown>);
}

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

function parseTableNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }
    const trimmed = item.trim();
    return trimmed.length > 0 ? [trimmed.slice(0, 40)] : [];
  });

  return parsed.length > 0 ? parsed : null;
}

function parseSeatSlotsField(
  data: Record<string, unknown>,
): RsvpRecord["seatSlots"] {
  const raw = data.seatSlots;
  if (!Array.isArray(raw)) {
    return null;
  }

  const parsed = raw.flatMap((item): { seatOrder: number; seatPosition: string }[] => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const o = item as Record<string, unknown>;
    const seatOrder = o.seatOrder;
    const seatPosition = o.seatPosition;
    if (typeof seatOrder !== "number" || !Number.isFinite(seatOrder)) {
      return [];
    }
    if (typeof seatPosition !== "string") {
      return [];
    }
    return [{ seatOrder, seatPosition }];
  });

  return parsed.length > 0 ? parsed : null;
}

export async function createRsvp(input: CreateRsvpInput) {
  const db = getFirebaseDb();
  const layoutMeta = await fetchSeatingLayoutMeta();
  const payload = {
    ...input,
    ...(layoutMeta
      ? {
          seatingTableCount: layoutMeta.tableCount,
          seatingTablePositions: layoutMeta.tablePositions,
          seatingTableNames: layoutMeta.tableNames,
          seatingTableCategories: layoutMeta.tableCategories,
        }
      : {}),
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return docRef.id;
}

export async function listRsvps(): Promise<RsvpRecord[]> {
  const db = getFirebaseDb();
  const layoutMeta = await fetchSeatingLayoutMeta();
  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc")),
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString();

    let seatingTableCount =
      typeof data.seatingTableCount === "number" && Number.isFinite(data.seatingTableCount)
        ? data.seatingTableCount
        : null;
    let seatingTablePositions = parseTablePositions(data.seatingTablePositions);
    let seatingTableNames = parseTableNames(data.seatingTableNames);

    if (layoutMeta) {
      if (seatingTableCount === null) {
        seatingTableCount = layoutMeta.tableCount;
      }
      if (!seatingTablePositions || seatingTablePositions.length === 0) {
        seatingTablePositions = layoutMeta.tablePositions;
      }
      if (!seatingTableNames || seatingTableNames.length === 0) {
        seatingTableNames = layoutMeta.tableNames;
      }
    }

    let seatingTableCategories: SeatingTableCategory[] | null = null;
    const layoutCount = seatingTableCount ?? layoutMeta?.tableCount ?? null;
    if (layoutCount !== null && layoutCount > 0) {
      if (
        Array.isArray(data.seatingTableCategories) &&
        data.seatingTableCategories.length > 0
      ) {
        seatingTableCategories = parseTableCategories(
          data.seatingTableCategories,
          layoutCount,
        );
      } else if (layoutMeta) {
        seatingTableCategories = layoutMeta.tableCategories;
      } else {
        seatingTableCategories = parseTableCategories(undefined, layoutCount);
      }
    }

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
      isSingle:
        data.isSingle === true ? true : data.isSingle === false ? false : null,
      needsPaperInvitation: Boolean(data.needsPaperInvitation),
      mailingAddress: String(data.mailingAddress ?? ""),
      message: String(data.message ?? ""),
      seatAssigned: Boolean(data.seatAssigned),
      seatOrder: typeof data.seatOrder === "number" ? data.seatOrder : null,
      seatPosition: typeof data.seatPosition === "string" ? data.seatPosition : null,
      seatSlots: parseSeatSlotsField(data),
      seatingTableCount,
      seatingTablePositions,
      seatingTableNames,
      seatingTableCategories,
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
    tableNames: string[];
    tableCategories: SeatingTableCategory[];
  },
) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const slotsByGuestId = new Map<
    string,
    Array<{ seatOrder: number; seatPosition: string }>
  >();
  for (const item of assignments) {
    const list = slotsByGuestId.get(item.id) ?? [];
    list.push({ seatOrder: item.seatOrder, seatPosition: item.seatPosition });
    slotsByGuestId.set(item.id, list);
  }
  for (const [, list] of slotsByGuestId) {
    list.sort((a, b) => a.seatOrder - b.seatOrder);
  }
  const batch = writeBatch(db);

  snapshot.docs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const slots = slotsByGuestId.get(snapshotDoc.id);
    const isAttending = Boolean(data.attending);

    if (slots && slots.length > 0 && isAttending) {
      const first = slots[0]!;
      batch.update(snapshotDoc.ref, {
        seatAssigned: true,
        seatSlots: slots,
        seatOrder: first.seatOrder,
        seatPosition: first.seatPosition,
        seatingTableCount: seatingLayout.tableCount,
        seatingTablePositions: seatingLayout.tablePositions,
        seatingTableNames: seatingLayout.tableNames,
        seatingTableCategories: seatingLayout.tableCategories,
      });
      return;
    }

    const hasAssignedSeat =
      Boolean(data.seatAssigned) ||
      (Array.isArray(data.seatSlots) && data.seatSlots.length > 0) ||
      typeof data.seatOrder === "number" ||
      typeof data.seatPosition === "string";

    if (hasAssignedSeat) {
      batch.update(snapshotDoc.ref, {
        seatAssigned: false,
        seatOrder: null,
        seatPosition: null,
        seatSlots: [],
        seatingTableCount: seatingLayout.tableCount,
        seatingTablePositions: seatingLayout.tablePositions,
        seatingTableNames: seatingLayout.tableNames,
        seatingTableCategories: seatingLayout.tableCategories,
      });
      return;
    }

    batch.update(snapshotDoc.ref, {
      seatingTableCount: seatingLayout.tableCount,
      seatingTablePositions: seatingLayout.tablePositions,
      seatingTableNames: seatingLayout.tableNames,
      seatingTableCategories: seatingLayout.tableCategories,
    });
  });

  batch.set(
    doc(db, SEATING_META_REF[0], SEATING_META_REF[1]),
    {
      tableCount: seatingLayout.tableCount,
      tablePositions: seatingLayout.tablePositions,
      tableNames: seatingLayout.tableNames,
      tableCategories: seatingLayout.tableCategories,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await batch.commit();
}
