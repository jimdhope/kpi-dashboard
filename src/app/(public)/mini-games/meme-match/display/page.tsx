import { MemeMatchPresentation } from '@/components/mini-games/meme-match-presentation';

export default async function MemeMatchDisplayPage({ searchParams }: { searchParams: Promise<{ code?: string; token?: string }> }) {
  const params = await searchParams;
  return <MemeMatchPresentation code={params.code || ''} token={params.token || ''} />;
}
