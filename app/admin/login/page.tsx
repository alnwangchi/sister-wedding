import { AdminLoginForm } from "@/components/admin-login-form";

export default async function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-8">
      <div className="w-full max-w-xl">
        <AdminLoginForm />
      </div>
    </main>
  );
}
