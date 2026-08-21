import { QuizShowPresentation } from '@/components/mini-games/quiz-show-presentation';

export default async function QuizShowDisplayPage({ searchParams }: { searchParams: Promise<{ code?: string; token?: string }> }) {
  const params = await searchParams;
  return <QuizShowPresentation code={params.code || ''} token={params.token || ''} />;
}
