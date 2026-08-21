"use client";

import { createContext, useContext } from "react";
import { ACT_THEMES, type ActTheme } from "./themes";

export const ThemeContext = createContext<ActTheme>(ACT_THEMES.opening);

export function useSlideTheme(): ActTheme {
  return useContext(ThemeContext);
}
