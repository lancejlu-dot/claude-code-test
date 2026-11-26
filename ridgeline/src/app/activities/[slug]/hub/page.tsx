import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Car, EyeOff, Flag, Lock, MapPin, Megaphone, Pin, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/notices";
import { requireViewer } from "@/lib/auth";
import { getEventBySlug, getPrivateDetails } from "@/lib/data/public";
import { createClient } from "@/lib/supabase/server";
import { deletePost, joinCarpool, leaveCarpool, moderatePost, offerCarpool, pinPost, postMessage, removeCarpoolOffer } from "@/lib/actions/hub";
import { formatDateTime, relativeFromNow } from "@/lib/format";

export const metadata = { title: "Participant page", robots: { index: false } };

export default async function HubPage({ params }: PageProps<"/activities/[slug]/hub">) {
  const { slug } = await params;
  const viewer = await requireViewer(`/activities/${slug}/hub`);
  const e = await getEventBySlug(slug);
  if (!e) notFound();
  const sb = await createClient();
  const [{ data: isParticipant }, { data: isStaff }] = await Promise.all([
    sb.rpc("is_event_participant", { p_event: e.id, p_uid: viewer.id }),
    sb.rpc("is_event_staff", { p_event: e.id, p_uid: viewer.id }),
  ]);
  if (!isParticipant && !isStaff && !viewer.isModerator) {
    return (
      <div className="container-page max-w-xl py-20 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted" aria-hidden />
        <h1 className="mt-4 text-3xl text-forest-950">Participants only</h1>
        <p className="mt-2 text-muted">This page opens once you&apos;re selected for {e.title}.</p>
        <Link href={`/activities/${e.slug}`} className="btn-secondary mt-6">Back to activity</Link>
      </div>
    );
  }
  const path = `/activities/${e.slug}/hub`;
  const [logistics, { data: participants }, { data: posts }, { data: offers }] = await Promise.all([
    getPrivateDetails(e),
    sb.rpc("event_participants", { p_event: e.id }),
    sb.from("event_posts").select("id,body,is_announcement,pinned,hidden,created_at,author_id").eq("event_id", e.id).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    sb.from("carpool_offers").select("id,driver_id,seats,departure_area,departure_time_note,notes,carpool_riders(rider_id)").eq("event_id", e.id),
  ]);
  type P = { user_id: string; display_name: string; avatar_url: string | null; intro: string; completed_count: number; is_organizer: boolean; status: string };
  const people = (participants ?? []) as P[];
  const name = (id: string | null) => people.find((p) => p.user_id === id)?.display_name ?? "Organizer";
  const canModerate = Boolean(isStaff || viewer.isModerator);

  return (
    <div className="container-page py-10">
      <Link href={`/activities/${e.slug}`} className="text-sm text-lake-700 hover:underline">← Activity details</Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Participant page</p>
          <h1 className="mt-1 text-3xl text-forest-950 sm:text-4xl">{e.title}</h1>
          <p className="mt-1 text-muted">{formatDateTime(e.starts_at, e.time_zone)} · {e.general_location}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/events/${e.id}/ics`} className="btn-secondary btn-sm"><CalendarPlus className="h-4 w-4" aria-hidden />Add to calendar</a>
          <Link href={`/report?event=${e.id}`} className="btn-ghost btn-sm"><Flag className="h-4 w-4" aria-hidden />Report a concern</Link>
        </div>
      </div>
      {e.public_status === "cancelled" && <div className="mt-6"><Notice tone="warn" title="This activity was cancelled">{e.status_note}</Notice></div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section className="card space-y-3 p-6">
            <h2 className="flex items-center gap-2 text-xl text-forest-950"><MapPin className="h-5 w-5 text-ember-600" aria-hidden />Meeting instructions</h2>
            {logistics ? (
              <dl className="space-y-2 text-sm">
                <div><dt className="font-semibold">Meeting point</dt><dd>{logistics.meeting_location}{logistics.meeting_location_url && <> · <a className="text-lake-700 underline" href={logistics.meeting_location_url} target="_blank" rel="noopener noreferrer">Open map</a></>}</dd></div>
                {logistics.meeting_time_note && <div><dt className="font-semibold">Timing</dt><dd>{logistics.meeting_time_note}</dd></div>}
                {logistics.parking_information && <div><dt className="font-semibold">Parking</dt><dd>{logistics.parking_information}</dd></div>}
                {logistics.carpool_details && <div><dt className="font-semibold">Carpools</dt><dd>{logistics.carpool_details}</dd></div>}
                {logistics.additional_instructions && <div><dt className="font-semibold">Additional instructions</dt><dd>{logistics.additional_instructions}</dd></div>}
              </dl>
            ) : <p className="text-sm text-muted">Meeting details will appear here.</p>}
          </section>

          <section aria-labelledby="discussion">
            <h2 id="discussion" className="text-2xl text-forest-950">Updates & discussion</h2>
            <p className="mt-1 text-sm text-muted">Visible to confirmed participants and organizers. Moderated — please keep it friendly and on-topic. No private messaging.</p>
            <ActionForm action={postMessage} className="card mt-4 space-y-3 p-4" resetOnSuccess>
              <input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="path" value={path} />
              <label htmlFor="body" className="sr-only">Message</label>
              <textarea id="body" name="body" rows={3} maxLength={4000} placeholder="Ask a question or share an update…" className="input" />
              <div className="flex items-center justify-between">
                {isStaff ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcement" className="accent-forest-700" />Post as organizer announcement</label> : <span />}
                <SubmitButton className="btn-primary btn-sm" pendingText="Posting…">Post</SubmitButton>
              </div>
            </ActionForm>
            <ul className="mt-4 space-y-3">
              {(posts ?? []).map((p) => (
                <li key={p.id} className={`card p-4 ${p.is_announcement ? "ring-2 ring-ember-500/40" : ""} ${p.hidden ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-forest-950">
                      {p.is_announcement && <Megaphone className="h-4 w-4 text-ember-600" aria-label="Announcement" />}
                      {p.pinned && <Pin className="h-3.5 w-3.5 text-muted" aria-label="Pinned" />}
                      {name(p.author_id)}
                    </span>
                    <span className="text-xs text-muted">{relativeFromNow(p.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{p.body}</p>
                  {p.hidden && <p className="mt-2 text-xs text-ember-700">Hidden by a moderator</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.author_id === viewer.id && <form action={deletePost}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="path" value={path} /><button className="btn-ghost btn-sm"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</button></form>}
                    {canModerate && <form action={moderatePost}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="hidden" value={String(!p.hidden)} /><input type="hidden" name="path" value={path} /><button className="btn-ghost btn-sm"><EyeOff className="h-3.5 w-3.5" aria-hidden />{p.hidden ? "Restore" : "Hide"}</button></form>}
                    {isStaff && <form action={pinPost}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="pinned" value={String(!p.pinned)} /><input type="hidden" name="path" value={path} /><button className="btn-ghost btn-sm"><Pin className="h-3.5 w-3.5" aria-hidden />{p.pinned ? "Unpin" : "Pin"}</button></form>}
                    {p.author_id !== viewer.id && <Link href={`/report?event=${e.id}&post=${p.id}`} className="btn-ghost btn-sm"><Flag className="h-3.5 w-3.5" aria-hidden />Report</Link>}
                  </div>
                </li>
              ))}
              {(posts ?? []).length === 0 && <li className="text-sm text-muted">No posts yet.</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg text-forest-950">Who&apos;s coming ({people.length})</h2>
            <ul className="mt-3 space-y-3">
              {people.map((p) => (
                <li key={p.user_id}><Link href={`/members/${p.user_id}`} className="flex items-center gap-3 rounded-lg hover:bg-sand-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-moss-100 font-display text-forest-800">{p.display_name[0]}</span>
                  <span className="min-w-0 text-sm"><span className="block font-medium text-forest-950">{p.display_name}{p.is_organizer && <span className="chip ml-1.5 bg-ember-100 px-1.5 py-0 text-ember-700">Organizer</span>}</span>
                    <span className="block truncate text-xs text-muted">{p.completed_count} activities</span></span>
                </Link></li>
              ))}
            </ul>
          </section>

          {(e.required_equipment.length > 0 || e.recommended_equipment.length > 0) && (
            <section className="card p-5">
              <h2 className="text-lg text-forest-950">Equipment checklist</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {e.required_equipment.map((it) => <li key={it}><label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 accent-forest-700" />{it}</label></li>)}
                {e.recommended_equipment.map((it) => <li key={it}><label className="flex items-start gap-2 text-muted"><input type="checkbox" className="mt-0.5 accent-forest-700" />{it} (recommended)</label></li>)}
              </ul>
            </section>
          )}

          {e.carpool_enabled && (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-lg text-forest-950"><Car className="h-5 w-5 text-moss-400" aria-hidden />Carpools</h2>
              <p className="mt-1 text-xs text-muted">Share a general area only — never a home address. Riders: please chip in for fuel.</p>
              <ul className="mt-3 space-y-3">
                {(offers ?? []).map((o) => {
                  const riders = (o.carpool_riders as { rider_id: string }[]).map((r) => r.rider_id);
                  const mine = o.driver_id === viewer.id; const riding = riders.includes(viewer.id);
                  return (
                    <li key={o.id} className="rounded-xl bg-sand-50 p-3 text-sm">
                      <p className="font-semibold">{name(o.driver_id)} · {riders.length}/{o.seats} seats</p>
                      <p className="text-muted">From {o.departure_area}{o.departure_time_note ? ` · ${o.departure_time_note}` : ""}</p>
                      {o.notes && <p className="mt-1">{o.notes}</p>}
                      {riders.length > 0 && <p className="mt-1 text-xs text-muted">Riders: {riders.map(name).join(", ")}</p>}
                      <div className="mt-2">
                        {mine ? <form action={removeCarpoolOffer}><input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="path" value={path} /><button className="btn-ghost btn-sm">Remove my offer</button></form>
                          : riding ? <form action={leaveCarpool}><input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="path" value={path} /><button className="btn-ghost btn-sm">Leave carpool</button></form>
                          : riders.length < o.seats && isParticipant ? <form action={joinCarpool}><input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="path" value={path} /><button className="btn-secondary btn-sm">Request a seat</button></form> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {isParticipant && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-lake-700">Offer seats</summary>
                  <ActionForm action={offerCarpool} className="mt-3 space-y-3">
                    <input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="path" value={path} />
                    <Field label="Seats" htmlFor="seats"><input id="seats" name="seats" type="number" min={1} max={8} required className="input" /></Field>
                    <Field label="General departure area" htmlFor="departure_area"><input id="departure_area" name="departure_area" placeholder="e.g. Commercial-Broadway Station" required className="input" /></Field>
                    <Field label="Departure time" htmlFor="departure_time_note"><input id="departure_time_note" name="departure_time_note" className="input" /></Field>
                    <Field label="Notes" htmlFor="notes"><input id="notes" name="notes" className="input" /></Field>
                    <SubmitButton className="btn-primary btn-sm">Post offer</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
