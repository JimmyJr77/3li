import { cn } from "@/lib/utils";
import { presencePeerInitials, presencePeerLabel } from "./initials";
import type { PresencePeer } from "./types";

function peerBubbleColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 42% 42%)`;
}

type PagePresenceAvatarsProps = {
  peers: PresencePeer[];
  className?: string;
};

/**
 * Overlapping initials circles for “others on this page” (fixed bottom-right by default).
 */
export function PagePresenceAvatars({ peers, className }: PagePresenceAvatarsProps) {
  if (peers.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-row items-center justify-end",
        className,
      )}
      aria-label={`${peers.length} other viewer${peers.length === 1 ? "" : "s"} on this page`}
    >
      <ul className="flex flex-row items-center pr-1 [&>li]:-ml-2 [&>li:first-child]:ml-0">
        {peers.map((p) => (
          <li key={p.userId} className="relative">
            <span
              className="pointer-events-auto flex size-9 select-none items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-primary-foreground shadow-sm"
              style={{ backgroundColor: peerBubbleColor(p.userId) }}
              title={presencePeerLabel(p)}
            >
              {presencePeerInitials(p)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
