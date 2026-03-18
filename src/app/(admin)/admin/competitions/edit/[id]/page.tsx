'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditCompetitionPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  useEffect(() => {
    if (competitionId) {
      router.replace(`/admin/competitions/wizard?edit=${competitionId}`);
    } else {
      router.replace('/admin/competitions');
    }
  }, [competitionId, router]);

  return null;
}
