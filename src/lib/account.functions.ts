import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { listingInputSchema, type ListingSummary } from "./marketplace";

const LIST_SELECT =
  "id,title,price,category,condition,status,location,created_at,listing_images(url,position),seller:profiles!listings_seller_id_fkey(id,name,image)";

type Row = {
  id: string;
  title: string;
  price: number | string;
  category: string;
  condition: string;
  status: string;
  location: string;
  created_at: string;
  listing_images: { url: string; position: number }[] | null;
  seller: { id: string; name: string; image: string | null } | null;
};

function toSummary(row: Row): ListingSummary {
  const images = [...(row.listing_images ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    category: row.category,
    condition: row.condition,
    status: row.status,
    location: row.location,
    created_at: row.created_at,
    image: images[0]?.url ?? null,
    seller: row.seller ?? null,
  };
}

/* ---------------- profile ---------------- */

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id,name,email,image,bio")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(60),
        bio: z.string().trim().max(200).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ name: data.name, bio: data.bio })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- listings (owner) ---------------- */

export const getMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListingSummary[]> => {
    const { data, error } = await context.supabase
      .from("listings")
      .select(LIST_SELECT)
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as Row[]).map(toSummary);
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listingInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: created, error } = await context.supabase
      .from("listings")
      .insert({
        title: data.title,
        description: data.description,
        price: data.price,
        category: data.category,
        condition: data.condition,
        location: data.location,
        seller_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.images.length) {
      const { error: imgError } = await context.supabase.from("listing_images").insert(
        data.images.map((url, position) => ({
          listing_id: created.id,
          url,
          position,
        })),
      );
      if (imgError) throw new Error(imgError.message);
    }
    return { id: created.id as string };
  });

export const updateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    listingInputSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Ownership is enforced by RLS as well as this explicit check.
    const { data: owned, error: ownErr } = await context.supabase
      .from("listings")
      .select("id")
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!owned) throw new Error("You can only edit your own listings");

    const { error } = await context.supabase
      .from("listings")
      .update({
        title: data.title,
        description: data.description,
        price: data.price,
        category: data.category,
        condition: data.condition,
        location: data.location,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("listing_images").delete().eq("listing_id", data.id);
    if (data.images.length) {
      const { error: imgError } = await context.supabase.from("listing_images").insert(
        data.images.map((url, position) => ({ listing_id: data.id, url, position })),
      );
      if (imgError) throw new Error(imgError.message);
    }
    return { id: data.id };
  });

export const setListingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("listings")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("You can only change your own listings");
    return updated;
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("listings")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("You can only delete your own listings");
    return { ok: true };
  });

/* ---------------- favorites ---------------- */

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListingSummary[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select(`listing:listings(${LIST_SELECT})`)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as { listing: Row | null }[])
      .map((r) => r.listing)
      .filter((l): l is Row => Boolean(l))
      .map(toSummary);
  });

export const listFavoriteIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.listing_id as string);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ listingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing, error } = await context.supabase
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("listing_id", data.listingId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (existing) {
      const { error: delErr } = await context.supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id);
      if (delErr) throw new Error(delErr.message);
      return { favorited: false };
    }

    const { error: insErr } = await context.supabase
      .from("favorites")
      .insert({ user_id: context.userId, listing_id: data.listingId });
    if (insErr) throw new Error(insErr.message);
    return { favorited: true };
  });

/* ---------------- messaging ---------------- */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select(
        "id,created_at,updated_at,buyer_id,seller_id,listing:listings(id,title),buyer:profiles!conversations_buyer_id_fkey(id,name,image),seller:profiles!conversations_seller_id_fkey(id,name,image),messages(content,created_at)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    type Conv = {
      id: string;
      buyer_id: string;
      seller_id: string;
      updated_at: string;
      listing: { id: string; title: string } | null;
      buyer: { id: string; name: string; image: string | null } | null;
      seller: { id: string; name: string; image: string | null } | null;
      messages: { content: string; created_at: string }[] | null;
    };

    return (data as unknown as Conv[]).map((c) => {
      const last = [...(c.messages ?? [])].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1,
      )[0];
      const other = c.buyer_id === context.userId ? c.seller : c.buyer;
      return {
        id: c.id,
        listing: c.listing,
        other,
        lastMessage: last?.content ?? null,
        lastAt: last?.created_at ?? c.updated_at,
      };
    });
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: conv, error } = await context.supabase
      .from("conversations")
      .select(
        "id,buyer_id,seller_id,listing:listings(id,title,price,status),buyer:profiles!conversations_buyer_id_fkey(id,name,image),seller:profiles!conversations_seller_id_fkey(id,name,image)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) return null;

    const { data: messages, error: msgErr } = await context.supabase
      .from("messages")
      .select("id,content,created_at,sender_id")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    if (msgErr) throw new Error(msgErr.message);

    const c = conv as unknown as {
      buyer_id: string;
      buyer: { id: string; name: string; image: string | null } | null;
      seller: { id: string; name: string; image: string | null } | null;
    } & Record<string, unknown>;

    return {
      ...c,
      me: context.userId,
      other: c.buyer_id === context.userId ? c.seller : c.buyer,
      messages: (messages ?? []) as {
        id: string;
        content: string;
        created_at: string;
        sender_id: string;
      }[],
    } as unknown as {
      id: string;
      buyer_id: string;
      seller_id: string;
      listing: { id: string; title: string; price: number; status: string } | null;
      me: string;
      other: { id: string; name: string; image: string | null } | null;
      messages: { id: string; content: string; created_at: string; sender_id: string }[];
    };
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ listingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: listing, error } = await context.supabase
      .from("listings")
      .select("id,seller_id")
      .eq("id", data.listingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!listing) throw new Error("Listing not found");
    if (listing.seller_id === context.userId) throw new Error("This is your own listing");

    const { data: existing } = await context.supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", data.listingId)
      .eq("buyer_id", context.userId)
      .eq("seller_id", listing.seller_id)
      .maybeSingle();
    if (existing) return { id: existing.id as string };

    const { data: created, error: insErr } = await context.supabase
      .from("conversations")
      .insert({
        listing_id: data.listingId,
        buyer_id: context.userId,
        seller_id: listing.seller_id,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { id: created.id as string };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        content: z.string().trim().min(1, "Write a message").max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: context.userId,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    await context.supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    return { ok: true };
  });
