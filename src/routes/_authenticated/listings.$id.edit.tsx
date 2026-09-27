import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getListing } from "@/lib/listings.functions";
import { updateListing } from "@/lib/account.functions";
import { ListingForm } from "@/components/ListingForm";

export const Route = createFileRoute("/_authenticated/listings/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit listing — CampusCart" },
      { name: "description", content: "Update the details of your CampusCart listing." },
      { property: "og:title", content: "Edit listing — CampusCart" },
      { property: "og:description", content: "Update the details of your listing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateListing);
  const [busy, setBusy] = useState(false);

  const { data: listing, isPending } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: { id } }),
  });

  if (isPending) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink/60">Loading…</main>;
  }
  if (!listing) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-ink/60">Listing not found.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Edit listing</h1>
      <div className="mt-6">
        <ListingForm
          initial={{
            title: listing.title,
            description: listing.description,
            price: String(listing.price),
            category: listing.category,
            condition: listing.condition,
            location: listing.location,
            images: listing.listing_images.map((i) => i.url).join("\n"),
          }}
          submitLabel="Save changes"
          busy={busy}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              await updateFn({ data: { ...values, id } });
              await queryClient.invalidateQueries({ queryKey: ["listing", id] });
              await queryClient.invalidateQueries({ queryKey: ["listings"] });
              await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
              toast.success("Listing updated");
              navigate({ to: "/listings/$id", params: { id } });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't save your changes");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </main>
  );
}
