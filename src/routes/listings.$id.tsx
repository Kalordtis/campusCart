import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { getListing } from "@/lib/listings.functions";
import {
  deleteListing,
  listFavoriteIds,
  setListingStatus,
  startConversation,
  toggleFavorite,
} from "@/lib/account.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { CONDITION_LABEL, formatPrice, timeAgo } from "@/lib/marketplace";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/listings/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["listing", params.id],
      queryFn: () => getListing({ data: { id: params.id } }),
    }),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Listing unavailable — CampusCart" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.title} — ${formatPrice(loaderData.price)} on CampusCart`;
    const description = loaderData.description.slice(0, 150);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: { id } }),
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorite-ids"],
    queryFn: () => listFavoriteIds(),
    enabled: Boolean(user),
  });

  const toggleFavoriteFn = useServerFn(toggleFavorite);
  const startConversationFn = useServerFn(startConversation);
  const setStatusFn = useServerFn(setListingStatus);
  const deleteFn = useServerFn(deleteListing);

  if (!listing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Listing not found</h1>
        <p className="mt-2 text-sm text-ink/60">It may have been sold and removed.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-brand px-4 py-2 text-sm text-brand-foreground">
          Back to browse
        </Link>
      </main>
    );
  }

  const isOwner = user?.id === listing.seller_id;
  const favorited = (favoritesQuery.data ?? []).includes(listing.id);
  const images = listing.listing_images;

  async function requireAuth() {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signin", redirect: `/listings/${id}` } });
      return false;
    }
    return true;
  }

  async function onFavorite() {
    if (!(await requireAuth())) return;
    try {
      const res = await toggleFavoriteFn({ data: { listingId: id } });
      await queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(res.favorited ? "Saved to favorites" : "Removed from favorites");
    } catch {
      toast.error("Couldn't update favorites");
    }
  }

  async function onMessage() {
    if (!(await requireAuth())) return;
    setBusy(true);
    try {
      const res = await startConversationFn({ data: { listingId: id } });
      navigate({ to: "/messages/$conversationId", params: { conversationId: res.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open a conversation");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: "AVAILABLE" | "RESERVED" | "SOLD") {
    setBusy(true);
    try {
      await setStatusFn({ data: { id, status } });
      await queryClient.invalidateQueries({ queryKey: ["listing", id] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success(`Marked as ${status.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change the status");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this listing? This can't be undone.")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Listing deleted");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="panel rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-balance">{listing.title}</h1>
          <StatusBadge status={listing.status} />
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {images.length ? (
              <img
                src={images[active]?.url ?? images[0]!.url}
                alt={listing.title}
                width={1024}
                height={640}
                className="aspect-[16/10] w-full rounded-xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="grid aspect-[16/10] w-full place-items-center rounded-xl bg-frost text-sm text-ink/40 ring-1 ring-black/5">
                No photos yet
              </div>
            )}
            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <button key={img.id} type="button" onClick={() => setActive(i)}>
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      width={512}
                      height={512}
                      className={`aspect-square w-full rounded-xl object-cover ring-1 ${i === active ? "ring-brand" : "ring-black/5"}`}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-4 max-w-[56ch] whitespace-pre-line text-sm text-ink/70 text-pretty">
              {listing.description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-display text-3xl font-semibold">{formatPrice(listing.price)}</p>
            <p className="text-sm text-ink/50">
              {listing.category} · {CONDITION_LABEL[listing.condition]} ·{" "}
              {timeAgo(listing.created_at)}
            </p>
            <p className="text-sm text-ink/50">{listing.location}</p>

            <div className="mt-2 flex items-center gap-3 rounded-2xl bg-frost p-3 ring-1 ring-black/5">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 font-display font-semibold text-brand">
                {listing.seller?.name?.[0] ?? "S"}
              </div>
              <div>
                <p className="text-sm font-semibold">{listing.seller?.name ?? "Student"}</p>
                <p className="text-xs text-ink/50">{listing.seller?.bio ?? "CampusCart seller"}</p>
              </div>
            </div>

            {isOwner ? (
              <div className="space-y-2">
                <Link
                  to="/listings/$id/edit"
                  params={{ id }}
                  className="block rounded-full bg-brand px-4 py-2.5 text-center text-sm font-medium text-brand-foreground"
                >
                  Edit listing
                </Link>
                <div className="flex flex-wrap gap-2">
                  {(["AVAILABLE", "RESERVED", "SOLD"] as const)
                    .filter((s) => s !== listing.status)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => changeStatus(s)}
                        className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-ink ring-1 ring-black/5 disabled:opacity-60"
                      >
                        Mark {s.toLowerCase()}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="w-full rounded-full px-4 py-2.5 text-sm font-medium text-destructive ring-1 ring-destructive/30 disabled:opacity-60"
                >
                  Delete listing
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || listing.status === "SOLD"}
                  onClick={onMessage}
                  className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
                >
                  {listing.status === "SOLD" ? "Item sold" : "Message seller"}
                </button>
                <button
                  type="button"
                  onClick={onFavorite}
                  className="flex items-center justify-center gap-2 rounded-full bg-white/70 px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-black/5"
                >
                  <Heart className={`size-4 ${favorited ? "fill-reserved text-reserved" : ""}`} />
                  {favorited ? "Saved to favorites" : "Save to favorites"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
