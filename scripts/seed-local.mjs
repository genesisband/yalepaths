import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { SEED_PEOPLE } from "./seed-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const env = { ...readEnv(path.join(root, ".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run npm run stack first.");
  process.exit(1);
}
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error("Refusing to seed a non-local Supabase URL. This script is for local and test data only.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function loadUserIds() {
  const byEmail = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 200) break;
  }
  return byEmail;
}

const knownUsers = await loadUserIds();

for (const person of SEED_PEOPLE) {
  let id = knownUsers.get(person.email.toLowerCase()) ?? null;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    });
    if (error) throw new Error(`${person.email}: ${error.message}`);
    id = data.user.id;
  }
  const { error: profileError } = await admin.from("profiles").upsert({
    id,
    display_name: person.display_name,
    class_year: person.class_year,
    linkedin_url: person.linkedin_url ?? null,
    show_linkedin: Boolean(person.show_linkedin),
    phone: person.phone ?? null,
    show_phone: Boolean(person.show_phone),
    contact_email: person.contact_email ?? null,
    show_contact_email: Boolean(person.show_contact_email),
    yale_email_verified: true,
  });
  if (profileError) throw new Error(`${person.email} profile: ${profileError.message}`);
  const rows = person.experiences.map((experience) => ({ ...experience, owner_id: id }));
  const { error: experienceError } = await admin.from("experiences").upsert(rows);
  if (experienceError) throw new Error(`${person.email} experience: ${experienceError.message}`);
  console.log(`seeded ${person.display_name}`);
}
