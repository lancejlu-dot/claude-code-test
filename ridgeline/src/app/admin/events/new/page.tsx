import { PageHeader } from "@/components/notices";
import { requireAdmin } from "@/lib/auth";
import { EventForm } from "../event-form";
import { getEventFormData } from "../data";
import { ImageUploader } from "../image-uploader";

export const metadata = { title: "New event" };

export default async function NewEvent() {
  await requireAdmin();
  const d = await getEventFormData(true);
  return (
    <div>
      <PageHeader title="New event">Events start as drafts. Preview, then publish when ready.</PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <EventForm categories={d.categories} regions={d.regions} waiverTemplates={d.waiverTemplates} selectedWaivers={[]} staff={d.staff} organizers={[]}
          e={{ max_participants: 12, restrict_logistics: true, carpool_enabled: true, waitlist_enabled: true, payment_methods: ["none"] }} />
        <aside className="xl:sticky xl:top-24 xl:self-start"><ImageUploader /></aside>
      </div>
    </div>
  );
}
