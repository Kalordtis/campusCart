import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listFavorites, toggleFavorite } from "@/lib/account.functions";
import { ListingCard } from "@/components/ListingCard";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Your favorites — CampusCart" },
      { name: "description", content: "Listings you saved on CampusCart." },
      { property: "og:title", content: "Your favorites — CampusCart" },
      { property: "og:description", content: "Listings you saved on CampusCart." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const queryClient = useQueryClient();
  const toggleFn = useServerFn(toggleFavorite);
  const { data, isPending } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => listFavorites(),
  });

  async function remove(listingId: string) {
    try {
      await toggleFn({ data: { listingId } });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      toast.success("Removed from favorites");
    } catch {
      toast.error("Couldn't update favorites");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Favorites</h1>
      {isPending ? (
        <p className="mt-4 text-sm text-ink/60">Loading…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="panel mt-6 rounded-3xl p-10 text-center">
          <p className="font-display text-xl font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-ink/60">
            Tap the heart on any listing to keep it here.
          </p>
          <Link
            to="/"
            className="mt-5 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data!.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorited
              onToggleFavorite={remove}
            />
          ))}
        </div>
      )}
    </main>
  );
}
