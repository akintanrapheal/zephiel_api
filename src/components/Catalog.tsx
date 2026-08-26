"use client";

import { useMemo, useState } from "react";
import type { Api, Category } from "@/lib/types";
import ApiCard from "./ApiCard";
import { cn } from "@/lib/utils";

type Sort = "popular" | "rating" | "latency" | "name";

const sorts: { value: Sort; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "latency", label: "Fastest" },
  { value: "name", label: "A to Z" },
];

export default function Catalog({
  apis,
  categories = [],
  initialCategory = "all",
  lockCategory = false,
}: {
  apis: Api[];
  categories?: Category[];
  initialCategory?: string;
  lockCategory?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<Sort>("popular");
  const [freeOnly, setFreeOnly] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = apis.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (freeOnly && !a.freeTier) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.provider.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "latency") return a.latency - b.latency;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.subscribers - a.subscribers;
    });

    return list;
  }, [apis, query, category, sort, freeOnly]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${apis.length} ${apis.length === 1 ? "API" : "APIs"} by name, use case, or tag...`}
            className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-muted transition hover:text-ink">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          Free tier
        </label>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-brand-400"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {!lockCategory && (
        <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1">
          <Pill active={category === "all"} onClick={() => setCategory("all")}>
            All categories
          </Pill>
          {categories.map((c) => (
            <Pill key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </Pill>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        <span className="font-semibold text-ink">{results.length}</span>{" "}
        {results.length === 1 ? "API" : "APIs"} found
      </p>

      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-sm font-medium text-ink">No APIs match that search.</p>
          <p className="mt-1 text-sm text-muted">Try a broader term, or clear the free-tier filter.</p>
          <button
            onClick={() => {
              setQuery("");
              setFreeOnly(false);
              if (!lockCategory) setCategory("all");
            }}
            className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-elevated"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((api) => (
            <ApiCard key={api.slug} api={api} />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-surface text-muted hover:border-brand-300 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
