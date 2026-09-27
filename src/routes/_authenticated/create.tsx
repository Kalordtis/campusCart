import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { createListing } from "@/lib/account.functions";
import { EMPTY_LISTING, ListingForm } from "@/components/ListingForm";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Sell an item — CampusCart" },
      { name: "description", content: "List something for sale on your campus marketplace." },
      { property: "og:title", content: "Sell an item — CampusCart" },
      { property: "og:description", content: "List something for sale on your campus." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createListing);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Sell an item</h1>
      <p className="mt-1 text-sm text-ink/60">
        Add a few details and photos so buyers know what they're getting.
      </p>
      <div className="mt-6">
        <ListingForm
          initial={EMPTY_LISTING}
          submitLabel="Publish listing"
          busy={busy}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              const res = await createFn({ data: values });
              await queryClient.invalidateQueries({ queryKey: ["listings"] });
              await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
              toast.success("Listing published");
              navigate({ to: "/listings/$id", params: { id: res.id } });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't publish the listing");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </main>
  );
}
