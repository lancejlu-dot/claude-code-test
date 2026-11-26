import { ActionForm, SubmitButton } from "@/components/forms";
import { uploadEventImage } from "@/lib/actions/admin";

export function ImageUploader() {
  return (
    <ActionForm action={uploadEventImage} className="card space-y-3 p-5">
      <p className="font-semibold text-forest-950">Upload a photo</p>
      <p className="text-xs text-muted">JPG, PNG, WebP or AVIF up to 10 MB. Images are optimised automatically when displayed. Only use photos you have rights to, with consent from anyone identifiable.</p>
      <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="w-full text-sm" aria-label="Image file" />
      <SubmitButton className="btn-secondary btn-sm" pendingText="Uploading…">Upload</SubmitButton>
    </ActionForm>
  );
}
