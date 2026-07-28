import { cn } from "@/lib/utils";

type Tone = "light" | "strong" | "dark";

function toneClass(tone: Tone | undefined) {
  return cn(
    "vm-skel",
    tone === "strong" && "vm-skel-strong",
    tone === "dark" && "vm-skel-on-dark",
  );
}
export function Skel({
  className,
  style,
  tone,
  delay,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone; delay?: number }) {
  return (
    <div
      aria-hidden
      className={cn(toneClass(tone), className)}
      style={
        delay != null ? { animationDelay: `0s, ${delay}ms`, ...style } : style
      }
      {...props}
    />
  );
}

function rowLineWidth(row: number, col: number, total: number) {
  if (col === 0) return 52 + ((row * 13) % 30);
  if (col === total - 1) return 34 + ((row * 7) % 26);
  return 60 + ((row * 11) % 28);
}

export function SkeletonRows({
  rows = 5,
  lines = 2,
  avatar = true,
  avatarClassName,
  tone,
  className,
  rowClassName,
}: {
  rows?: number;
  lines?: number;
  avatar?: boolean;
  avatarClassName?: string;
  tone?: Tone;
  className?: string;
  rowClassName?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn("flex items-start gap-3 px-1 py-3", rowClassName)}
        >
          {avatar && (
            <Skel
              tone={tone}
              delay={i * 60}
              className={cn("h-9 w-9 shrink-0 rounded-lg", avatarClassName)}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            {Array.from({ length: lines }).map((__, j) => (
              <Skel
                key={j}
                tone={tone}
                delay={i * 60 + j * 40}
                className="h-3 rounded"
                style={{ width: `${rowLineWidth(i, j, lines)}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonLines({
  lines = 3,
  tone,
  className,
  lastWidth = "58%",
  lineClassName,
}: {
  lines?: number;
  tone?: Tone;
  className?: string;
  lastWidth?: string;
  lineClassName?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skel
          key={i}
          tone={tone}
          delay={i * 60}
          className={cn("h-3 rounded", lineClassName)}
          style={{
            width: i === lines - 1 ? lastWidth : `${82 + ((i * 9) % 16)}%`,
          }}
        />
      ))}
    </div>
  );
}
