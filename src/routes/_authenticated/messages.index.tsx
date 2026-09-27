import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { listConversations } from "@/lib/account.functions";
import { timeAgo } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — CampusCart" },
      { name: "description", content: "Your conversations with campus buyers and sellers." },
      { property: "og:title", content: "Messages — CampusCart" },
      { property: "og:description", content: "Your conversations with buyers and sellers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { data, isPending } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Messages</h1>
      {isPending ? (
        <p className="mt-4 text-sm text-ink/60">Loading…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="panel mt-6 rounded-3xl p-10 text-center">
          <p className="font-display text-xl font-semibold">No conversations yet</p>
          <p className="mt-1 text-sm text-ink/60">
            Message a seller from any listing to start one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {data!.map((c) => (
            <Link
              key={c.id}
              to="/messages/$conversationId"
              params={{ conversationId: c.id }}
              className="panel flex items-center gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 font-display font-semibold text-brand">
                {c.other?.name?.[0] ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.other?.name ?? "Student"}</p>
                <p className="truncate text-xs text-ink/50">{c.listing?.title}</p>
                <p className="truncate text-sm text-ink/70">{c.lastMessage ?? "No messages yet"}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-ink/40">{timeAgo(c.lastAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
