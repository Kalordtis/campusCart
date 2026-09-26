import { z } from "zod";

export const CATEGORIES = [
  "Furniture",
  "Electronics",
  "Textbooks",
  "Clothing",
  "Kitchen",
  "School Supplies",
  "Sports",
  "Other",
] as const;

export const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR"] as const;
export const STATUSES = ["AVAILABLE", "RESERVED", "SOLD"] as const;

export const CONDITION_LABEL: Record<string, string> = {
  NEW: "New",
  LIKE_NEW: "Like New",
  GOOD: "Good",
  FAIR: "Fair",
};

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
};

export const SORTS = ["newest", "price_asc", "price_desc"] as const;

export const listingInputSchema = z.object({
  title: z.string().trim().min(4, "Title needs at least 4 characters").max(90),
  description: z.string().trim().min(10, "Add a few more details").max(2000),
  price: z.number().min(0, "Price must be positive").max(100000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  location: z.string().trim().min(2, "Where can buyers pick this up?").max(80),
  images: z
    .array(z.string().trim().url("Each image must be a valid URL"))
    .max(6, "Up to 6 images")
    .default([]),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

export type ListingSummary = {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  status: string;
  location: string;
  created_at: string;
  image: string | null;
  seller: { id: string; name: string; image: string | null } | null;
};

export function formatPrice(price: number) {
  return `$${Number(price) % 1 === 0 ? Number(price).toFixed(0) : Number(price).toFixed(2)}`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
