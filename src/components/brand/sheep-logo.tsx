import { cn } from "@/lib/utils"

/**
 * Sheepit mark: a wool cloud built from overlapping circles, a dark face
 * and a lime "spark" ear tag. Works from 16px favicons up to hero size.
 */
export function SheepMark({ className, title = "Sheepit" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} role="img" aria-label={title}>
      <title>{title}</title>
      {/* legs */}
      <rect x="20" y="44" width="5" height="12" rx="2.5" fill="#17171c" />
      <rect x="38" y="44" width="5" height="12" rx="2.5" fill="#17171c" />
      {/* wool */}
      <g fill="var(--wool, #f6f1e4)">
        <circle cx="22" cy="28" r="11" />
        <circle cx="34" cy="22" r="12" />
        <circle cx="45" cy="30" r="10" />
        <circle cx="37" cy="38" r="11" />
        <circle cx="23" cy="39" r="10" />
        <circle cx="14" cy="33" r="7" />
      </g>
      {/* face */}
      <ellipse cx="13" cy="31" rx="8.5" ry="10" fill="#17171c" />
      <ellipse cx="7" cy="25" rx="4.5" ry="2.4" transform="rotate(-25 7 25)" fill="#17171c" />
      <circle cx="11" cy="29" r="1.7" fill="#fff" />
      <circle cx="16" cy="29" r="1.7" fill="#fff" />
      <circle cx="11.4" cy="29.3" r="0.8" fill="#17171c" />
      <circle cx="16.4" cy="29.3" r="0.8" fill="#17171c" />
      {/* ear tag / spark */}
      <path d="M20 21.5 l2.2 -5 l2.2 5 l5 2.2 l-5 2.2 l-2.2 5 l-2.2 -5 l-5 -2.2 z" fill="var(--lime, #c6f432)" />
    </svg>
  )
}

export function SheepWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <SheepMark className="size-7" />
      <span className="text-[1.05rem]">
        sheep<span className="text-primary">it</span>
      </span>
    </span>
  )
}
