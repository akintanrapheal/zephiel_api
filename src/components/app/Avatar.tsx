import { cn } from "@/lib/utils";

/**
 * A person's picture, or their initials when they have not set one.
 *
 * The version parameter comes from avatar_updated_at: the image is cached
 * immutably, so without it a new upload would not appear until the cache
 * expired.
 */
export default function Avatar({
  userId,
  name,
  email,
  updatedAt,
  size = 32,
  className,
}: {
  userId: string;
  name?: string | null;
  email: string;
  updatedAt?: Date | string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    (name?.trim() || email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  if (updatedAt) {
    const v = new Date(updatedAt).getTime();
    return (
      // A plain img: the bytes come from our own route and are already sized
      // to 256px square, so the optimizer has nothing left to do.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${userId}?v=${v}`}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={email}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
