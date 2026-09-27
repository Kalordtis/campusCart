import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getConversation, sendMessage } from "@/lib/account.functions";
import { formatPrice, timeAgo } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation — CampusCart" },
      { name: "description", content: "Chat with a campus buyer or seller." },
      { property: "og:title", content: "Conversation — CampusCart" },
      { property: "og:description", content: "Chat with a campus buyer or seller." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const queryClient = useQueryClient();
  const sendFn = useServerFn(sendMessage);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation({ data: { id: conversationId } }),
    refetchInterval: 15000,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await sendFn({ data: { conversationId, content: text.trim() } });
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message didn't send");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink/60">Loading…</main>;
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-ink/60">
        Conversation not found.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="panel rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/5 pb-4">
          <div className="grid size-10 place-items-center rounded-full bg-brand/15 font-display font-semibold text-brand">
            {data.other?.name?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold">{data.other?.name ?? "Student"}</p>
            {data.listing ? (
              <Link
                to="/listings/$id"
                params={{ id: data.listing.id }}
                className="text-xs text-ink/50 hover:text-ink"
              >
                {data.listing.title} · {formatPrice(data.listing.price)}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {data.messages.map((m) => {
            const mine = m.sender_id === data.me;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine ? "bg-brand text-brand-foreground" : "bg-white/80 text-ink ring-1 ring-black/5"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.content}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-ink/40"}`}>
                    {timeAgo(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          {data.messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/50">
              Say hello and ask about the item.
            </p>
          ) : null}
        </div>

        <form onSubmit={submit} className="mt-5 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            className="flex-1 rounded-full bg-white/70 px-4 py-2.5 text-sm ring-1 ring-black/5 outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
