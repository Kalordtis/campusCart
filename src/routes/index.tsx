import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { listListings, type ListingFilters } from "@/lib/listings.functions";
import { listFavoriteIds, toggleFavorite } from "@/lib/account.functions";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, CONDITIONS, CONDITION_LABEL, STATUSES, STATUS_LABEL } from "@/lib/marketplace";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Browse listings — CampusCart" },
      {
        name: "description",
        content:
          "Search desks, mini fridges, textbooks and tech listed by students on your campus.",
      },
      { property: "og:title", content: "Browse listings — CampusCart" },
      {
        property: "og:description",
        content: "Search desks, mini fridges, textbooks and tech listed by students.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["listings", {}],
      queryFn: () => listListings({ data: {} }),
    }),
  component: BrowsePage,
});

const chip = "rounded-full bg-white/60 px-3 py-1.5 text-sm font-medium text-ink/70 ring-1 ring-black/5";
const chipActive = "rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white ring-1 ring-brand";

function BrowsePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ListingFilters>({});
  const [searchText, setSearchText] = useState("");

  const listingsQuery = useQuery({
    queryKey: ["listings", filters],
    queryFn: () => listListings({ data: filters }),
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorite-ids"],
    queryFn: () => listFavoriteIds(),
    enabled: Boolean(user),
  });

  const toggleFavoriteFn = useServerFn(toggleFavorite);

  async function onToggleFavorite(listingId: string) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signin", redirect: "/" } });
      return;
    }
    try {
      const res = await toggleFavoriteFn({ data: { listingId } });
      await queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(res.favorited ? "Saved to favorites" : "Removed from favorites");
    } catch {
      toast.error("Couldn't update your favorites");
    }
  }

  function update(patch: Partial<ListingFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  const favorites = new Set(favoritesQuery.data ?? []);
  const listings = listingsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <form
        className="panel flex items-center gap-2 rounded-2xl px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          update({ search: searchText.trim() || undefined });
        }}
      >
        <Search className="size-4 text-ink/40" />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search desk, laptop, textbook, bike…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
        <button type="submit" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-frost">
          Search
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-display text-sm font-semibold text-ink/50">Categories</span>
        <button
          type="button"
          className={filters.category ? chip : chipActive}
          onClick={() => update({ category: undefined })}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={filters.category === c ? chipActive : chip}
            onClick={() => update({ category: filters.category === c ? undefined : c })}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="panel mt-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
        <span className="text-sm font-medium text-ink/60">Sort</span>
        {(
          [
            ["newest", "Newest"],
            ["price_asc", "Price low–high"],
            ["price_desc", "Price high–low"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => update({ sort: value })}
            className={
              (filters.sort ?? "newest") === value
                ? "rounded-full bg-ink px-3 py-1 text-sm font-medium text-frost"
                : "rounded-full px-3 py-1 text-sm font-medium text-ink/60"
            }
          >
            {label}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min $"
            className="w-24 rounded-full bg-white/60 px-3 py-1.5 text-sm ring-1 ring-black/5 outline-none"
            onChange={(e) => update({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input
            type="number"
            min={0}
            placeholder="Max $"
            className="w-24 rounded-full bg-white/60 px-3 py-1.5 text-sm ring-1 ring-black/5 outline-none"
            onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
          <select
            className="rounded-full bg-white/60 px-3 py-1.5 text-sm ring-1 ring-black/5 outline-none"
            value={filters.condition ?? ""}
            onChange={(e) =>
              update({ condition: (e.target.value || undefined) as ListingFilters["condition"] })
            }
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            className="rounded-full bg-white/60 px-3 py-1.5 text-sm ring-1 ring-black/5 outline-none"
            value={filters.status ?? ""}
            onChange={(e) =>
              update({ status: (e.target.value || undefined) as ListingFilters["status"] })
            }
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listingsQuery.isPending ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="panel h-72 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : listingsQuery.isError ? (
        <div className="panel mt-6 rounded-2xl p-8 text-center text-sm text-ink/60">
          We couldn't load listings just now. Try again in a moment.
        </div>
      ) : listings.length === 0 ? (
        <div className="panel mt-6 rounded-2xl p-10 text-center">
          <p className="font-display text-xl font-semibold">No listings match those filters</p>
          <p className="mt-1 text-sm text-ink/60">Try a different search or clear a filter.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorited={favorites.has(listing.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </main>
  );
}
