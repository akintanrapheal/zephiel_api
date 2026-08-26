"use client";

import { useActionState } from "react";
import { saveApi, type FormState } from "@/server/actions/admin";
import { Check, Field, Message, Select, Submit, TextArea } from "./Form";
import type { Api, Category } from "@/lib/types";

export default function ApiForm({
  api,
  categories,
}: {
  api?: Api & { categoryId?: string | null };
  categories: Category[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveApi, null);

  return (
    <form action={formAction} className="space-y-6">
      {api?.id && <input type="hidden" name="id" value={api.id} />}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Basics</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={api?.name} required placeholder="Multistore" />
          <Field
            label="Slug"
            hint="URL path"
            name="slug"
            defaultValue={api?.slug}
            required
            placeholder="multistore"
          />
          <Field
            label="Tagline"
            className="sm:col-span-2"
            name="tagline"
            defaultValue={api?.tagline}
            placeholder="One line shown on the catalog card."
          />
          <Select label="Category" name="categoryId" defaultValue={api?.categoryId ?? ""}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Field label="Provider" name="provider" defaultValue={api?.provider} placeholder="Zephiel Labs" />
          <Field
            label="Logo"
            hint="1–4 characters"
            name="logo"
            maxLength={4}
            defaultValue={api?.logo}
            placeholder="MS"
          />
          <Field
            label="Colour"
            hint="hex"
            name="color"
            defaultValue={api?.color ?? "#2445d6"}
            placeholder="#2445d6"
          />
        </div>

        <TextArea
          label="Description"
          className="mt-4"
          name="description"
          rows={5}
          defaultValue={api?.description}
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Listing details</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Rating" name="rating" type="number" step="0.1" min="0" max="5" defaultValue={api?.rating ?? 5} />
          <Field label="Reviews" name="reviews" type="number" min="0" defaultValue={api?.reviews ?? 0} />
          <Field label="Subscribers" name="subscribers" type="number" min="0" defaultValue={api?.subscribers ?? 0} />
          <Field label="Latency (ms)" name="latency" type="number" min="0" defaultValue={api?.latency ?? 100} />
          <Field label="Uptime (%)" name="uptime" type="number" step="0.01" min="0" max="100" defaultValue={api?.uptime ?? 99.9} />
        </div>

        <Field
          label="Tags"
          hint="comma separated"
          className="mt-4"
          name="tags"
          defaultValue={api?.tags?.join(", ")}
          placeholder="multistore, ecommerce, inventory sync"
        />

        <TextArea
          label="Use cases"
          hint="one per line"
          className="mt-4"
          name="useCases"
          rows={4}
          defaultValue={api?.useCases?.join("\n")}
        />

        <TextArea
          label="Sample response"
          hint="JSON returned by the gateway"
          className="mt-4"
          name="sampleResponse"
          rows={8}
          defaultValue={api?.sampleResponse ?? "{}"}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Check label="Published" name="published" defaultChecked={api?.published ?? true} />
          <Check label="Featured" name="featured" defaultChecked={api?.featured ?? false} />
          <Check label="Has free tier" name="freeTier" defaultChecked={api?.freeTier ?? true} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Submit>{api?.id ? "Save changes" : "Create API"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
