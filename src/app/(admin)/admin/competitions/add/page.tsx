'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AddCompetitionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/competitions/wizard');
  }, [router]);

  return null;
}
