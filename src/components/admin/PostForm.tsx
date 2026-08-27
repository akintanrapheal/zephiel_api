"use client";

import { useActionState } from "react";
import { savePost } from "@/server/actions/posts";
import type { FormState } from "@/server/actions/admin";
import { Check, Field, Message, Submit, TextArea } from "./Form";
import type { Post } from "@/server/posts";

export default function PostForm({ post }: { post?: Post }) {
  const [state, action] = useActionState<FormState, FormData>(savePost, null);

  return (
    <form action={action} className="space-y-5">
      {post?.id && <input type="hidden" name="id" value={post.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" defaultValue={post?.title} required />
        <Field label="Slug" hint="URL path" name="slug" defaultValue={post?.slug} required />
        <Field label="Tag" name="tag" defaultValue={post?.tag ?? "Engineering"} />
        <Field
          label="Read time"
          hint="minutes"
          name="readMinutes"
          type="number"
          min="1"
          defaultValue={post?.readMinutes ?? 5}
        />
      </div>

      <TextArea label="Excerpt" hint="shown on cards" name="excerpt" rows={3} defaultValue={post?.excerpt} />
      <TextArea
        label="Body"
        hint="blank line between paragraphs; prefix a line with ## for a heading"
        name="body"
        rows={16}
        defaultValue={post?.body}
      />

      <Check label="Published" name="published" defaultChecked={post?.published ?? true} />

      <div className="flex items-center gap-3">
        <Submit>{post?.id ? "Save post" : "Create post"}</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
