import { useState } from "react";
import { CATEGORIES, CONDITIONS, CONDITION_LABEL, listingInputSchema } from "@/lib/marketplace";

export type ListingFormValues = {
  title: string;
  description: string;
  price: string;
  category: string;
  condition: string;
  location: string;
  images: string;
};

export const EMPTY_LISTING: ListingFormValues = {
  title: "",
  description: "",
  price: "",
  category: "Furniture",
  condition: "GOOD",
  location: "",
  images: "",
};

const field = "w-full rounded-xl bg-white/70 px-4 py-2.5 text-sm ring-1 ring-black/5 outline-none";

export function ListingForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial: ListingFormValues;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: ReturnType<typeof listingInputSchema.parse>) => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: keyof ListingFormValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = listingInputSchema.safeParse({
      title: values.title,
      description: values.description,
      price: Number(values.price),
      category: values.category,
      condition: values.condition,
      location: values.location,
      images: values.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form className="panel space-y-4 rounded-3xl p-6" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium">Title</label>
        <input
          className={field}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="IKEA desk, white"
        />
        {errors["title"] ? <p className="mt-1 text-xs text-destructive">{errors["title"]}</p> : null}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          className={`${field} min-h-28`}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Condition details, why you're selling, pickup info…"
        />
        {errors["description"] ? (
          <p className="mt-1 text-xs text-destructive">{errors["description"]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Price ($)</label>
          <input
            type="number"
            min={0}
            step="1"
            className={field}
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
          />
          {errors["price"] ? (
            <p className="mt-1 text-xs text-destructive">{errors["price"]}</p>
          ) : null}
        </div>
        <div>
          <label className="text-sm font-medium">Pickup location</label>
          <input
            className={field}
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="North Quad, Bldg C"
          />
          {errors["location"] ? (
            <p className="mt-1 text-xs text-destructive">{errors["location"]}</p>
          ) : null}
        </div>
        <div>
          <label className="text-sm font-medium">Category</label>
          <select
            className={field}
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Condition</label>
          <select
            className={field}
            value={values.condition}
            onChange={(e) => set("condition", e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Photo links (one per line, up to 6)</label>
        <textarea
          className={`${field} min-h-20`}
          value={values.images}
          onChange={(e) => set("images", e.target.value)}
          placeholder="https://example.com/photo.jpg"
        />
        <p className="mt-1 text-xs text-ink/50">
          Paste image links for now — direct photo uploads can be added later.
        </p>
        {errors["images"] ? (
          <p className="mt-1 text-xs text-destructive">{errors["images"]}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
