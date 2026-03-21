import { AdminDashboard } from "@/components/admin-dashboard";
import { isFirebaseConfigured } from "@/lib/firebase";
import { mockRsvps } from "@/lib/mock-rsvps";
import { listRsvps } from "@/lib/rsvp-store";
import type { RsvpRecord } from "@/types/rsvp";

type AdminPageProps = {
  searchParams?: Promise<{ mock?: string }> | { mock?: string };
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const usingMockData = resolvedSearchParams?.mock === "true";
  const firebaseConfigured = isFirebaseConfigured();
  let displayRecords: RsvpRecord[] = [];

  if (usingMockData) {
    displayRecords = mockRsvps;
  } else if (firebaseConfigured) {
    displayRecords = await listRsvps();
  }

  return (
    <main className="px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <AdminDashboard records={displayRecords} usingMockData={usingMockData} />
      </div>
    </main>
  );
}
