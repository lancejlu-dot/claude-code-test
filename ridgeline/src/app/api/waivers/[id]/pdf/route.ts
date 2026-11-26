import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrand } from "@/lib/data/public";
import { renderPdf } from "@/lib/pdf";

// Downloadable signed waiver record. RLS: the signer, admins, or staff of the related event.
export async function GET(_: Request, ctx: RouteContext<"/api/waivers/[id]/pdf">) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: s } = await sb.from("waiver_signatures")
    .select("id,signature_name,signer_display,signed_at,ip_address,user_agent,body_sha256,version,waiver_templates(title,legal_reviewed),waiver_versions(body),events(title)")
    .eq("id", id).maybeSingle();
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const brand = await getBrand();
  const t = s.waiver_templates as unknown as { title: string; legal_reviewed: boolean };
  const body = (s.waiver_versions as unknown as { body: string }).body;
  const ev = s.events as unknown as { title: string } | null;
  const bytes = await renderPdf(`${t.title} (version ${s.version})`, [
    { heading: "Signed record", body: `Signed by: ${s.signer_display}\nTyped signature: ${s.signature_name}\nSigned at (UTC): ${new Date(s.signed_at).toISOString()}\nIP address: ${s.ip_address ?? "not recorded"}\nDevice: ${s.user_agent ?? "not recorded"}${ev ? `\nActivity: ${ev.title}` : ""}\nDocument SHA-256: ${s.body_sha256}` },
    { heading: "Document text", body },
  ], `${brand.name} electronic signature record. ${t.legal_reviewed ? "" : "TEMPLATE NOT YET LEGALLY REVIEWED."}`);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="waiver-${s.id.slice(0, 8)}.pdf"`, "Cache-Control": "no-store" } });
}
