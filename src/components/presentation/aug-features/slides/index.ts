"use client";

import type { ComponentType } from "react";
import type { ActId } from "../themes";
import { S01Title } from "./s01-title";
import { S02Dashboard } from "./s02-dashboard";
import { S03BybIntro } from "./s03-byb-intro";
import { S04BybMechanics } from "./s04-byb-mechanics";
import { S05BybExperience } from "./s05-byb-experience";
import { S06LeagueIntro } from "./s06-league-intro";
import { S07MonthlySprints } from "./s07-monthly-sprints";
import { S08PromotionRelegation } from "./s08-promotion-relegation";
import { S09NextYear } from "./s09-next-year";
import { S10Close } from "./s10-close";

export type SlideDef = {
  id: string;
  act: ActId;
  Component: ComponentType;
};

export const SLIDES: SlideDef[] = [
  { id: "title", act: "opening", Component: S01Title },
  { id: "dashboard", act: "dashboard", Component: S02Dashboard },
  { id: "byb-intro", act: "byb", Component: S03BybIntro },
  { id: "byb-mechanics", act: "byb", Component: S04BybMechanics },
  { id: "byb-experience", act: "byb", Component: S05BybExperience },
  { id: "league-intro", act: "league", Component: S06LeagueIntro },
  { id: "monthly-sprints", act: "league", Component: S07MonthlySprints },
  { id: "promotion-relegation", act: "league", Component: S08PromotionRelegation },
  { id: "next-year", act: "league", Component: S09NextYear },
  { id: "close", act: "close", Component: S10Close },
];
