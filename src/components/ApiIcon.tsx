import { iconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "h-9 w-9 rounded-lg", glyph: "h-[18px] w-[18px]", text: "text-[11px]" },
  md: { box: "h-11 w-11 rounded-xl", glyph: "h-[22px] w-[22px]", text: "text-[13px]" },
  lg: { box: "h-16 w-16 rounded-2xl", glyph: "h-8 w-8", text: "text-xl" },
} as const;

/**
 * A listing's mark: its registry icon when one is set, otherwise the
 * two-letter monogram. Decorative — the API name is always beside it — so it
 * is hidden from assistive technology.
 */
export default function ApiIcon({
  api,
  size = "md",
  className,
}: {
  api: { name?: string; logo: string; color: string; icon?: string | null };
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  const path = iconPath(api.icon);

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-bold text-white shadow-sm",
        s.box,
        s.text,
        className
      )}
      style={{ background: `linear-gradient(140deg, ${api.color}, ${api.color}c0)` }}
    >
      {path ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={s.glyph}>
          <path d={path} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        api.logo
      )}
    </span>
  );
}
