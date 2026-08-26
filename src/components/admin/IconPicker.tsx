"use client";

import { useState } from "react";
import { apiIcons, iconKeys } from "@/lib/icons";
import { cn } from "@/lib/utils";

export default function IconPicker({
  name,
  defaultValue,
  color,
}: {
  name: string;
  defaultValue?: string;
  color?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");

  return (
    <fieldset>
      <legend className="text-xs font-semibold text-ink">
        Icon
        <span className="ml-2 font-normal text-muted">shown on the catalog card</span>
      </legend>

      <input type="hidden" name={name} value={selected} />

      <div
        role="radiogroup"
        aria-label="Listing icon"
        className="mt-2 flex flex-wrap gap-2 rounded-xl border border-line bg-bg p-3"
      >
        <IconSwatch
          label="Monogram"
          selected={selected === ""}
          onSelect={() => setSelected("")}
          color={color}
        />

        {iconKeys.map((key) => (
          <IconSwatch
            key={key}
            label={apiIcons[key].label}
            path={apiIcons[key].path}
            selected={selected === key}
            onSelect={() => setSelected(key)}
            color={color}
          />
        ))}
      </div>
    </fieldset>
  );
}

function IconSwatch({
  label,
  path,
  selected,
  onSelect,
  color = "#2445d6",
}: {
  label: string;
  path?: string;
  selected: boolean;
  onSelect: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-lg border-2 transition",
        selected ? "border-brand-500" : "border-transparent hover:border-line"
      )}
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-md text-[10px] font-bold text-white"
        style={{ background: `linear-gradient(140deg, ${color}, ${color}c0)` }}
      >
        {path ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
            <path d={path} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          "Aa"
        )}
      </span>
    </button>
  );
}
