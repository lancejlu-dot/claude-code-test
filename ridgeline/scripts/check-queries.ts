/**
 * Static check: every supabase `.from(table).select("…")` in src/ references real
 * tables, columns, relationships and FK hints in the migrated schema.
 * Usage: DATABASE_URL=postgresql:///ridgeline_dev npx tsx scripts/check-queries.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const db = process.env.DATABASE_URL ?? "postgresql:///rl_dev";
const q = (sql: string) => execFileSync("psql", [db, "-At", "-F", "|", "-c", sql], { encoding: "utf8" }).trim().split("\n").filter(Boolean).map((l) => l.split("|"));

const columns = new Map<string, Set<string>>();
for (const [t, c] of q(`select table_name, column_name from information_schema.columns where table_schema='public'`)) {
  if (!columns.has(t)) columns.set(t, new Set());
  columns.get(t)!.add(c);
}
// FK edges: [constraint, from_table, to_table]
const fks = q(`select con.conname, src.relname, dst.relname from pg_constraint con join pg_class src on src.oid=con.conrelid join pg_class dst on dst.oid=con.confrelid
  join pg_namespace n on n.oid=src.relnamespace where con.contype='f' and n.nspname='public'`);
const related = (a: string, b: string, hint?: string) =>
  fks.some(([name, s, d]) => (!hint || name === hint) && ((s === a && d === b) || (s === b && d === a)));
const fkCount = (a: string, b: string) => fks.filter(([, s, d]) => (s === a && d === b) || (s === b && d === a)).length;

function splitTop(s: string) {
  const out: string[] = []; let depth = 0; let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const errors: string[] = [];
function check(table: string, select: string, where: string) {
  const cols = columns.get(table);
  if (!cols) { errors.push(`${where}: unknown table/view ${table}`); return; }
  for (const raw of splitTop(select.replace(/\s+/g, " "))) {
    if (raw === "*" || raw.startsWith("count")) continue;
    const m = /^(?:(\w+):)?(\w+)(?:!(\w+))?(?:\((.*)\))?$/.exec(raw);
    if (!m) { errors.push(`${where}: cannot parse "${raw}"`); continue; }
    const [, , name, hint, inner] = m;
    if (inner === undefined) {
      if (!cols.has(name)) errors.push(`${where}: ${table}.${name} does not exist`);
      continue;
    }
    if (!columns.has(name)) { errors.push(`${where}: embedded ${name} is not a table`); continue; }
    if (!related(table, name, hint)) errors.push(`${where}: no FK between ${table} and ${name}${hint ? ` named ${hint}` : ""}`);
    else if (!hint && fkCount(table, name) > 1) errors.push(`${where}: ambiguous embed ${table} → ${name}; add !fk_hint`);
    if (inner.trim() !== "count") check(name, inner, `${where} > ${name}`);
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
}
let n = 0;
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  const re = /\.from\("(\w+)"\)\s*\.select\(\s*(`[^`]*`|"[^"]*")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) { n++; check(m[1], m[2].slice(1, -1), `${file}`); }
  // columns used in .eq/.in/.order etc. right after from(table)
}
// RPC calls: function exists and every named argument is a real parameter; required params are supplied.
const fns = q(`select p.proname, coalesce(array_to_string(p.proargnames, ','), ''), p.pronargs, p.pronargdefaults
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
let r = 0;
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  const re = /\.rpc\(\s*(?:"(\w+)"|fn)\s*(?:,\s*\{([^}]*)\})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (!m[1]) continue;
    r++;
    const name = m[1];
    const given = (m[2] ?? "").split(",").map((x) => x.split(":")[0].trim()).filter((x) => /^p_\w+$/.test(x));
    const cands = fns.filter(([f]) => f === name);
    if (!cands.length) { errors.push(`${file}: rpc ${name} does not exist`); continue; }
    const ok = cands.some(([, args, nargs, ndef]) => {
      const names = args ? args.split(",").slice(0, Number(nargs)) : [];
      const required = names.slice(0, Number(nargs) - Number(ndef));
      return given.every((g) => names.includes(g)) && required.every((x) => given.includes(x));
    });
    if (!ok) errors.push(`${file}: rpc ${name}(${given.join(", ")}) does not match its parameters`);
  }
}
// rpc(fn, args) helper calls in admin actions: rpc("name", {...})
for (const file of walk("src/lib/actions")) {
  const src = readFileSync(file, "utf8");
  const re = /\brpc\("(\w+)",\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    r++;
    const given = m[2].split(",").map((x) => x.split(":")[0].trim()).filter((x) => /^p_\w+$/.test(x));
    const cands = fns.filter(([f]) => f === m![1]);
    if (!cands.length) { errors.push(`${file}: rpc ${m[1]} does not exist`); continue; }
    if (!cands.some(([, args, nargs, ndef]) => { const names = args.split(",").slice(0, Number(nargs)); return given.every((g) => names.includes(g)) && names.slice(0, Number(nargs) - Number(ndef)).every((x) => given.includes(x)); }))
      errors.push(`${file}: rpc ${m[1]}(${given.join(", ")}) does not match its parameters`);
  }
}
// Lifecycle map in admin actions: ["fn", { p_… }]
for (const m of readFileSync("src/lib/actions/admin.ts", "utf8").matchAll(/\["(\w+)",\s*\{([^}]*)\}/g)) {
  r++;
  const given = m[2].split(",").map((x) => x.split(":")[0].trim()).filter((x) => /^p_\w+$/.test(x));
  const cands = fns.filter(([f]) => f === m[1]);
  if (!cands.some(([, args, nargs, ndef]) => { const names = args.split(",").slice(0, Number(nargs)); return given.every((g) => names.includes(g)) && names.slice(0, Number(nargs) - Number(ndef)).every((x) => given.includes(x)); }))
    errors.push(`admin.ts lifecycle: ${m[1]}(${given.join(", ")}) mismatch`);
}
console.log(`Checked ${n} select statements and ${r} rpc calls.`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("All tables, columns, relationships and RPC signatures resolve.");
