import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORIES, CONDITIONS, SORTS, STATUSES, type ListingSummary } from "./marketplace";

const LIST_SELECT =
  "id,title,price,category,condition,status,location,created_at,listing_images(url,position),seller:profiles!listings_seller_id_fkey(id,name,image)";

const filterSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  condition: z.enum(CONDITIONS).optional(),
  status: z.enum(STATUSES).optional(),
  sort: z.enum(SORTS).default("newest"),
  sellerId: z.string().uuid().optional(),
});

export type ListingFilters = z.input<typeof filterSchema>;

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

export const listListings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<ListingSummary[]> => {
    const { getPublicClient } = await import("./supabase-public.server");
    const supabase = getPublicClient();

    let query = supabase.from("listings").select(LIST_SELECT);

    if (data.search) {
      const term = data.search.replace(/[%,()]/g, " ").trim();
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%,location.ilike.%${term}%`,
        );
      }
    }
    if (data.category) query = query.eq("category", data.category);
    if (data.condition) query = query.eq("condition", data.condition);
    if (data.status) query = query.eq("status", data.status);
    if (data.sellerId) query = query.eq("seller_id", data.sellerId);
    if (typeof data.minPrice === "number") query = query.gte("price", data.minPrice);
    if (typeof data.maxPrice === "number") query = query.lte("price", data.maxPrice);

    if (data.sort === "price_asc") query = query.order("price", { ascending: true });
    else if (data.sort === "price_desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data: rows, error } = await query.limit(60);
    if (error) throw new Error(error.message);
    return (rows as unknown as Row[]).map(toSummary);
  });

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./supabase-public.server");
    const supabase = getPublicClient();
    const { data: row, error } = await supabase
      .from("listings")
      .select(
        "id,title,description,price,category,condition,status,location,created_at,seller_id,listing_images(id,url,position),seller:profiles!listings_seller_id_fkey(id,name,image,bio)",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    const r = row as unknown as {
      price: number | string;
      listing_images: { id: string; url: string; position: number }[] | null;
    } & Record<string, unknown>;

    return {
      ...r,
      price: Number(r.price),
      listing_images: [...(r.listing_images ?? [])].sort((a, b) => a.position - b.position),
    } as {
      id: string;
      title: string;
      description: string;
      price: number;
      category: string;
      condition: string;
      status: string;
      location: string;
      created_at: string;
      seller_id: string;
      listing_images: { id: string; url: string; position: number }[];
      seller: { id: string; name: string; image: string | null; bio: string | null } | null;
    };
  });
