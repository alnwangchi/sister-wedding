import { AdminDashboard } from "@/components/admin-dashboard";
import { isFirebaseConfigured } from "@/lib/firebase";
import { mockRsvps } from "@/lib/mock-rsvps";
import { listRsvps } from "@/lib/rsvp-store";

export default async function AdminPage() {
  const firebaseConfigured = isFirebaseConfigured();
  const records = firebaseConfigured ? await listRsvps() : [];
  const displayRecords = records.length > 0 ? records : mockRsvps;
  const usingMockData = displayRecords === mockRsvps;

  return (
    <main className="px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <AdminDashboard records={displayRecords} usingMockData={usingMockData} firebaseConfigured={firebaseConfigured} />
      </div>
    </main>
  );
}
