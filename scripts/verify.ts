import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { filterExperiences, pinsFrom } from "../lib/experiences.ts";
import { clearMail, waitForCode } from "./mail.mjs";

const exec = promisify(execFile);
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !serviceKey) throw new Error("Run npm run stack so .env.local exists.");

const now = { year: 2026, month: 11 };
const ownerEmail = "verify.owner@yale.edu";
const readerEmail = "verify.reader@yale.edu";
const lab = "Atlas Pilot Lab";

function client() {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email: string) {
  clearMail(email);
  const supabase = client();
  const sent = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (sent.error) throw new Error(`${email}: ${sent.error.message}`);
  const code = await waitForCode(email);
  const verified = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (verified.error || !verified.data.user) throw new Error(`${email}: ${verified.error?.message ?? "no user"}`);
  const { error } = await supabase.rpc("ensure_profile");
  if (error) throw new Error(`${email} profile: ${error.message}`);
  return { supabase, userId: verified.data.user.id };
}

async function psql(sql: string) {
  const { stdout } = await exec("/opt/homebrew/opt/postgresql@14/bin/psql", [
    "-h",
    "127.0.0.1",
    "-p",
    "54322",
    "-U",
    "postgres",
    "-d",
    "yalepaths",
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-c",
    sql,
  ]);
  return stdout.trim();
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const failures: string[] = [];
function check(name: string, condition: unknown) {
  if (condition) console.log(`ok ${name}`);
  else {
    console.error(`not ok ${name}`);
    failures.push(name);
  }
}

async function main() {
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
for (const user of listed?.users ?? []) {
  if (user.email === ownerEmail || user.email === readerEmail) await admin.auth.admin.deleteUser(user.id);
}

const gmail = await client().auth.signInWithOtp({ email: "person@gmail.com", options: { shouldCreateUser: true } });
check("ineligible signup is rejected", Boolean(gmail.error?.message.includes("yale.edu")));

const anonClient = client();
const anonRead = await anonClient.from("experiences").select("organization, lab_name");
check("signed-out read returns no records", !anonRead.error && (anonRead.data?.length ?? 0) === 0);

const owner = await signIn(ownerEmail);
await owner.supabase.from("profiles").update({ display_name: "Verify Owner", class_year: 2026 }).eq("id", owner.userId);
const inserted = await owner.supabase
  .from("experiences")
  .insert({
    owner_id: owner.userId,
    role: "Research assistant",
    organization: "EPFL",
    experience_type: "research",
    city: "Lausanne",
    region: "Switzerland",
    lat: 46.5197,
    lng: 6.6323,
    lab_name: lab,
    note: "Pilot record.",
    start_year: 2023,
    start_month: 6,
    end_year: 2023,
    end_month: 8,
    ongoing: false,
    shared: true,
  })
  .select("id")
  .single();
if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "insert failed");
const sharedId = inserted.data.id;
const priv = await owner.supabase
  .from("experiences")
  .insert({
    owner_id: owner.userId,
    role: "Draft",
    organization: "Private Org",
    experience_type: "other",
    city: "New Haven",
    region: "Connecticut, United States",
    lat: 41.3083,
    lng: -72.9279,
    start_year: 2022,
    start_month: 1,
    end_year: 2022,
    end_month: 5,
    ongoing: false,
    shared: false,
  })
  .select("id")
  .single();
if (priv.error || !priv.data) throw new Error(priv.error?.message ?? "private insert failed");

const reader = await signIn(readerEmail);
await reader.supabase.from("profiles").update({ display_name: "Verify Reader", class_year: 2025 }).eq("id", reader.userId);
const visible = await reader.supabase.from("experiences").select("*");
if (visible.error) throw new Error(visible.error.message);
const catalog = (visible.data ?? []).filter((row) => row.shared);
const found = filterExperiences(catalog, { query: lab, type: "research", year: 2023 }, now);
const pins = pinsFrom(found);
check("reader finds the shared lab in 2023", found.length === 1 && found[0].organization === "EPFL");
check("pin count uses that same row", pins.length === 1 && pins[0].city === "Lausanne" && pins[0].count === 1);
check("reader cannot see the private entry", !(visible.data ?? []).some((row) => row.id === priv.data.id));

const crossed = await reader.supabase.from("experiences").update({ note: "hijack" }).eq("id", sharedId).select("id");
const reread = await owner.supabase.from("experiences").select("note").eq("id", sharedId).single();
check("reader cannot edit the owner's entry", (crossed.data?.length ?? 0) === 0 && reread.data?.note === "Pilot record.");

const ownEdit = await owner.supabase.from("experiences").update({ note: "Pilot record updated." }).eq("id", sharedId).select("note").single();
check("owner can edit their own entry", ownEdit.data?.note === "Pilot record updated.");

const hidden = await owner.supabase.from("experiences").update({ shared: false }).eq("id", sharedId).select("id").single();
check("owner can hide the entry", Boolean(hidden.data));
const after = await reader.supabase.from("experiences").select("id, organization, lab_name, shared");
const afterFound = filterExperiences((after.data ?? []).filter((row) => row.shared), { query: lab, type: null, year: 2023 }, now);
const afterPins = pinsFrom(afterFound);
const profile = await reader.supabase.from("profiles").select("display_name").eq("id", owner.userId).maybeSingle();
check("hiding removes the entry from search and pins", afterFound.length === 0 && afterPins.length === 0);
check("hiding removes the profile while nothing else is shared", !profile.data);

await psql(`
begin;
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('99999999-9999-4999-8999-999999999999', 'authenticated', 'authenticated', 'sneak@gmail.com', now(), now(), now());
select set_config('request.jwt.claims', '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated","email":"sneak@gmail.com"}', true);
set local role authenticated;
do $$
declare
  visible int;
begin
  select count(*) into visible from public.experiences;
  if visible <> 0 then
    raise exception 'ineligible session saw % experiences', visible;
  end if;
  select count(*) into visible from public.profiles;
  if visible <> 0 then
    raise exception 'ineligible session saw % profiles', visible;
  end if;
end $$;
rollback;
`);
check("confirmed non-Yale session cannot read experiences", true);

await admin.auth.admin.deleteUser(owner.userId);
await admin.auth.admin.deleteUser(reader.userId);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("api checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
