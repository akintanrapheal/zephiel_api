"use client";

import { useActionState, useRef, useState } from "react";
import {
  changeMyName,
  changeMyEmail,
  changeMyPassword,
  uploadAvatar,
  removeAvatar,
} from "@/server/actions/profile";
import type { FormState } from "@/server/actions/admin";
import { useFormStatus } from "react-dom";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function Note({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p
      className={
        "error" in state && state.error
          ? "text-sm font-medium text-rose-600"
          : "text-sm font-medium text-accent"
      }
    >
      {"error" in state && state.error ? state.error : "ok" in state ? state.ok : null}
    </p>
  );
}

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeMyName, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block sm:max-w-sm">
        <span className="text-xs font-semibold text-ink">Display name</span>
        <input name="name" defaultValue={name} required maxLength={80} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Submit>Save name</Submit>
        <Note state={state} />
      </div>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeMyEmail, null);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        You sign in with <span className="font-medium text-ink">{email}</span>. Changing it signs you
        out on other devices.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">New email address</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue={email}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Your password</span>
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className={field}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit>Change email</Submit>
        <Note state={state} />
      </div>
    </form>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeMyPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Current password</span>
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">New password</span>
          <input name="next" type="password" required minLength={12} autoComplete="new-password" className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Confirm new password</span>
          <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className={field} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit>Change password</Submit>
        <Note state={state} />
      </div>
    </form>
  );
}

export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(uploadAvatar, null);
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" />
        )}

        <label className="cursor-pointer rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-elevated">
          {/*
            accept + capture are what make this usable on a phone: the browser
            offers the camera and photo library directly instead of a file
            manager.
          */}
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
              if (f) formRef.current?.requestSubmit();
            }}
          />
          {hasAvatar ? "Choose a new picture" : "Choose a picture"}
        </label>

        {hasAvatar && (
          <button
            type="button"
            onClick={() => removeAvatar()}
            className="text-sm font-medium text-rose-600 hover:underline"
          >
            Remove
          </button>
        )}

        <Note state={state} />
      </div>

      <p className="text-xs leading-6 text-muted">
        JPEG, PNG, WebP, or HEIC, up to 8MB. Photos are cropped square and resized to 256px, so a
        picture straight from your phone camera is fine.
      </p>
    </form>
  );
}
