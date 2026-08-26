"use client";

import { useActionState } from "react";
import { saveCategory, type FormState } from "@/server/actions/admin";
import { Field, Message, Submit, TextArea } from "./Form";

type Row = { id: string; slug: string; name: string; blurb: string; icon: string; sort_order: number };

export default function CategoryForm({ category }: { category?: Row }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveCategory, null);

  return (
    <form action={formAction} className="space-y-4">
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" name="name" defaultValue={category?.name} required placeholder="E-commerce" />
        <Field label="Slug" name="slug" defaultValue={category?.slug} required placeholder="ecommerce" />
        <Field
          label="Sort order"
          name="sortOrder"
          type="number"
          min="0"
          defaultValue={category?.sort_order ?? 0}
        />
      </div>

      <Field label="Blurb" name="blurb" defaultValue={category?.blurb} placeholder="One line for the card." />

      <TextArea
        label="Icon"
        hint="SVG path data, drawn on a 24×24 viewBox"
        name="icon"
        rows={2}
        defaultValue={category?.icon}
        placeholder="M4 6h16M4 12h16M4 18h10"
      />

      <div className="flex items-center gap-3">
        <Submit>{category?.id ? "Save category" : "Add category"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
