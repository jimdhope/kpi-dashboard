"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  checkedLabel?: string;
}

export function Toggle({ checked, onChange, label, checkedLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
        checked ? "bg-primary/10 text-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      <span className={cn("flex-1", checked && "line-through opacity-60")}>
        {checked && checkedLabel ? checkedLabel : label}
      </span>
      <span
        className={cn(
          "relative ml-3 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
