'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/admin-auth';

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const loggedIn = isAdminLoggedIn();

    if (!loggedIn) {
      router.replace('/admin/login');
      setChecked(true);
      setAuthorized(false);
      return;
    }

    setChecked(true);
    setAuthorized(true);
  }, [router]);

  if (!checked || !authorized) {
    return null;
  }

  return <>{children}</>;
}
