// Wall-clock conversions for the community time zone (admin forms use datetime-local inputs).
export const TZ = "America/Vancouver";

/** Convert a wall-clock time in `tz` to a UTC ISO string (DST-safe). */
export function zonedToUtc(date: string, time: string, tz = TZ): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(guess)).map((x) => [x.type, x.value]),
    );
    guess += Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(guess).toISOString();
}

/** "2026-12-05T08:30" (datetime-local) in tz → ISO, or null. */
export const localInputToIso = (v: string | null | undefined, tz = TZ) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  return zonedToUtc(v.slice(0, 10), v.slice(11, 16), tz);
};

/** ISO → "YYYY-MM-DDTHH:MM" in tz, for datetime-local default values. */
export function isoToLocalInput(iso: string | null | undefined, tz = TZ) {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
