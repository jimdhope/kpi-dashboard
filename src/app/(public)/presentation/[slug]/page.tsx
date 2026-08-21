import type { Metadata } from "next";
import {
  getPresentation,
  listPresentations,
} from "@/components/presentation/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return listPresentations().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getPresentation(slug);
  return {
    title: entry ? `${entry.title} — KPI Quest` : "Presentation — KPI Quest",
    robots: { index: false, follow: false },
  };
}

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getPresentation(slug);
  if (!entry) return null;
  const Deck = entry.component;
  return <Deck />;
}
