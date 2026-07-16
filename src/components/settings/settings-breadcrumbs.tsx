"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { SETTINGS_NAVIGATION_ITEMS } from "@/components/settings/settings-navigation";

export function SettingsBreadcrumbs() {
  return (
    <Breadcrumbs
      sectionItems={SETTINGS_NAVIGATION_ITEMS}
      className="sticky top-[65px] z-40 border-b bg-background/95 backdrop-blur-sm md:hidden"
    />
  );
}
