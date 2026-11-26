"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/format";

export type ActionResult = { ok: boolean; message?: string; error?: string; redirectTo?: string } | null;
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, className = "btn-primary", pendingText, confirm, name, value }:
  { children: ReactNode; className?: string; pendingText?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className} aria-busy={pending}
      onClick={(ev) => { if (confirm && !window.confirm(confirm)) ev.preventDefault(); }}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult }) {
  if (!state) return null;
  const isErr = !state.ok;
  return (
    <div role={isErr ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm", isErr ? "bg-ember-100 text-ember-700" : "bg-moss-100 text-forest-800")}>
      {isErr ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>{isErr ? state.error : state.message}</span>
    </div>
  );
}

/** A form bound to a server action with inline success/error feedback. */
export function ActionForm({ action, children, className, resetOnSuccess, messagePosition = "bottom" }:
  { action: FormAction; children: ReactNode; className?: string; resetOnSuccess?: boolean; messagePosition?: "top" | "bottom" }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
    if (state?.redirectTo) window.location.assign(state.redirectTo);
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {messagePosition === "top" && <FormMessage state={state} />}
      {children}
      {messagePosition === "bottom" && <FormMessage state={state} />}
    </form>
  );
}

export function Field({ label, htmlFor, hint, required, children, className }:
  { label: string; htmlFor: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}{required && <span className="text-ember-600" aria-hidden> *</span>}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
