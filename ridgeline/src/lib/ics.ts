// Minimal RFC 5545 calendar file for "Add to calendar".
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Folds lines longer than 75 octets as required by RFC 5545. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
};

export function buildIcs(e: { id: string; title: string; starts_at: string; ends_at: string | null; location?: string | null;
  description?: string | null; url: string; brand: string }) {
  const end = e.ends_at ?? new Date(Date.parse(e.starts_at) + 3 * 3600_000).toISOString();
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${esc(e.brand)}//Events//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.id}@${new URL(e.url).hostname}`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(e.title)}`,
    e.location ? `LOCATION:${esc(e.location)}` : "", `DESCRIPTION:${esc((e.description ?? "") + "\n\n" + e.url)}`, `URL:${e.url}`,
    "BEGIN:VALARM", "TRIGGER:-PT12H", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).map(fold).join("\r\n") + "\r\n";
}
