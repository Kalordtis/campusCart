import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getMyListings,
  getMyProfile,
  listFavorites,
  updateMyProfile,
} from "@/lib/account.functions";
import { ListingCard } from "@/components/ListingCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — CampusCart" },
      { name: "description", content: "Manage your listings, profile and saved items." },
      { property: "og:title", content: "Your dashboard — CampusCart" },
      { property: "og:description", content: "Manage your listings, profile and saved items." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const TABS = [
  ["ALL", "All"],
  ["AVAILABLE", "Active"],
  ["RESERVED", "Reserved"],
  ["SOLD", "Sold"],
] as const;

function DashboardPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("ALL");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const listingsQuery = useQuery({ queryKey: ["my-listings"], queryFn: () => getMyListings() });
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: () => listFavorites() });
  const updateProfileFn = useServerFn(updateMyProfile);

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name ?? "");
      setBio(profileQuery.data.bio ?? "");
    }
  }, [profileQuery.data]);

  const listings = listingsQuery.data ?? [];
  const shown = tab === "ALL" ? listings : listings.filter((l) => l.status === tab);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfileFn({ data: { name, bio } });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your profile");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <form onSubmit={saveProfile} className="panel h-fit rounded-3xl p-5">
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="mt-1 text-xs text-ink/50">{profileQuery.data?.email}</p>
          <label className="mt-4 block text-sm font-medium">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-white/70 px-4 py-2.5 text-sm ring-1 ring-black/5 outline-none"
          />
          <label className="mt-3 block text-sm font-medium">Short bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="min-h-20 w-full rounded-xl bg-white/70 px-4 py-2.5 text-sm ring-1 ring-black/5 outline-none"
            placeholder="Junior · usually replies in an hour"
          />
          <button
            type="submit"
            disabled={savingProfile}
            className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 font-display text-lg font-semibold">My listings</h2>
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={
                  tab === value
                    ? "rounded-full bg-ink px-3 py-1 text-sm font-medium text-frost"
                    : "rounded-full bg-white/60 px-3 py-1 text-sm font-medium text-ink/70 ring-1 ring-black/5"
                }
              >
                {label}
              </button>
            ))}
            <Link
              to="/create"
              className="ml-auto rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground"
            >
              New listing
            </Link>
          </div>

          {listingsQuery.isPending ? (
            <p className="mt-4 text-sm text-ink/60">Loading…</p>
          ) : shown.length === 0 ? (
            <div className="panel mt-4 rounded-3xl p-8 text-center text-sm text-ink/60">
              Nothing here yet.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {shown.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">Saved items</h2>
          <Link to="/favorites" className="text-sm text-brand">
            View all
          </Link>
        </div>
        {(favoritesQuery.data?.length ?? 0) === 0 ? (
          <div className="panel mt-4 rounded-3xl p-8 text-center text-sm text-ink/60">
            You haven't saved any listings yet.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {favoritesQuery.data!.slice(0, 4).map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
