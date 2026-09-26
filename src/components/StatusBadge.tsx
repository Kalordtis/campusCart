import { STATUS_LABEL } from "@/lib/marketplace";

const TONE: Record<string, string> = {
  AVAILABLE: "text-brand",
  RESERVED: "text-reserved",
  SOLD: "text-sold",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span
      className={`rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-black/5 ${TONE[status] ?? "text-ink"} ${className}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
