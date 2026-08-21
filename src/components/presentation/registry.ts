import type { ComponentType } from "react";
import { AugFeaturesDeck } from "./aug-features/deck";

export type PresentationEntry = {
  slug: string;
  title: string;
  component: ComponentType;
};

const PRESENTATIONS: PresentationEntry[] = [
  {
    slug: "Aug-Features-Update",
    title: "Autumn Features Launch",
    component: AugFeaturesDeck,
  },
];

export function listPresentations(): PresentationEntry[] {
  return PRESENTATIONS;
}

export function getPresentation(slug: string): PresentationEntry | undefined {
  return PRESENTATIONS.find((entry) => entry.slug === slug);
}
