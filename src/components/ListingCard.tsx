import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { CONDITION_LABEL, formatPrice, timeAgo, type ListingSummary } from "@/lib/marketplace";

export function ListingCard({
  listing,
  favorited,
  onToggleFavorite,
}: {
  listing: ListingSummary;
  favorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  const sold = listing.status === "SOLD";

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="panel group block rounded-2xl p-2.5 transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative">
        <StatusBadge status={listing.status} className="absolute left-2 top-2 z-10" />
        <span className="absolute right-2 top-2 z-10 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-ink ring-1 ring-black/5">
          {CONDITION_LABEL[listing.condition]}
        </span>
        {listing.image ? (
          <img
            src={listing.image}
            alt={listing.title}
            loading="lazy"
            width={816}
            height={816}
            className="aspect-square w-full rounded-xl object-cover ring-1 ring-black/5"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-xl bg-frost text-xs uppercase tracking-[0.15em] text-muted-foreground ring-1 ring-black/5">
            No photo
          </div>
        )}
        {onToggleFavorite ? (
          <button
            type="button"
            aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(listing.id);
            }}
            className="absolute bottom-2 right-2 z-10 grid size-9 place-items-center rounded-full bg-white/85 ring-1 ring-black/5 transition-colors hover:bg-white"
          >
            <Heart
              className={`size-4 ${favorited ? "fill-reserved text-reserved" : "text-ink/60"}`}
            />
          </button>
        ) : null}
      </div>
      <div className="px-1 pb-1 pt-2">
        <p
          className={`font-display text-lg font-semibold ${sold ? "text-ink/50 line-through" : "text-ink"}`}
        >
          {formatPrice(listing.price)}
        </p>
        <p className="mt-0.5 line-clamp-1 text-sm font-medium text-ink">{listing.title}</p>
        <p className="text-xs text-ink/50">
          {listing.category} · {timeAgo(listing.created_at)}
        </p>
        <p className="mt-1.5 line-clamp-1 text-xs text-ink/60">{listing.location}</p>
      </div>
    </Link>
  );
}
