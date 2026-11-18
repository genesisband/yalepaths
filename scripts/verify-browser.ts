import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { clearMail } from "./mail.mjs";

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
const base = process.env.YALEPATHS_URL || "http://127.0.0.1:3000";
const ownerEmail = "browser.owner@yale.edu";
const readerEmail = "browser.reader@yale.edu";
const lab = "Atlas Pilot Lab";

async function deleteUser(email: string) {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = data.users.find((item) => item.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

async function signIn(page: Page, email: string, name: string, year: string) {
  await page.goto(base);
  await page.getByTestId("email-input").fill(email);
  clearMail(email);
  await page.getByTestId("continue-yale").click();
  await page.getByTestId("display-name").fill(name);
  await page.getByLabel("Class year").fill(year);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("search").waitFor();
}

async function addSharedLab(page: Page) {
  await page.goto(`${base}/experience/new`);
  await page.getByTestId("role-input").fill("Research assistant");
  await page.getByTestId("organization-input").fill("EPFL");
  await page.getByTestId("type-input").selectOption("research");
  await page.getByTestId("city-input").fill("Lausanne");
  await page.getByRole("option", { name: "Lausanne, Switzerland" }).click();
  await page.getByTestId("lab-input").fill(lab);
  await page.getByTestId("start-input").fill("2023-06");
  await page.getByTestId("end-input").fill("2023-08");
  await page.getByTestId("share-input").check();
  await page.getByTestId("save-experience").click();
  await page.getByText(lab).waitFor();
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
await deleteUser(ownerEmail);
await deleteUser(readerEmail);
fs.mkdirSync("artifacts", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const readerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });

try {
  const owner = await ownerContext.newPage();
  const reader = await readerContext.newPage();
  await signIn(owner, ownerEmail, "Browser Ada", "2026");
  await addSharedLab(owner);

  await signIn(reader, readerEmail, "Browser Grace", "2025");
  await reader.getByTestId("search").fill(lab);
  await reader.getByTestId("year-filter").selectOption("2023");
  await reader.getByTestId("result-row").filter({ hasText: lab }).waitFor();
  const dates = await reader.getByTestId("result-row").first().innerText();
  assert(dates.includes("June 2023") && dates.includes("August 2023"), `dates were not shown: ${dates}`);

  await reader.getByTestId("search").fill("");
  await reader.getByTestId("year-filter").selectOption("");
  await reader.getByRole("heading", { name: "Oxford" }).waitFor();
  await reader.getByTestId("pin-lausanne-switzerland").waitFor();
  for (let step = 0; step < 4; step += 1) await reader.getByRole("button", { name: "Zoom in" }).click();
  await reader.getByTestId("pin-lausanne-switzerland").click();
  await reader.getByRole("heading", { name: "Lausanne" }).waitFor();
  assert((await reader.getByRole("heading", { name: "Oxford" }).count()) === 0, "pin click did not narrow the list");
  assert((await reader.getByTestId("result-row").filter({ hasText: lab }).count()) === 1, "lab row missing after pin selection");
  const pressed = await reader.getByTestId("pin-lausanne-switzerland").getAttribute("aria-pressed");
  assert(pressed === "true", "selected pin is not pressed");

  const globe = await reader.getByTestId("globe-pane").boundingBox();
  const list = await reader.getByTestId("result-list").boundingBox();
  assert(globe && list && globe.width > list.width * 1.5, "desktop globe is not about two thirds of the canvas");
  const wordmark = await reader.locator(".wordmark").evaluate((element) => getComputedStyle(element).fontFamily);
  assert(/instrument serif|__Instrument_Serif/i.test(wordmark), `wordmark font was ${wordmark}`);
  const paper = await reader.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(paper === "rgb(247, 244, 237)", `paper color was ${paper}`);
  await reader.screenshot({ path: "artifacts/desktop-explore.png", fullPage: true });

  await reader.setViewportSize({ width: 390, height: 844 });
  const searchBox = await reader.getByTestId("search").boundingBox();
  const yearBox = await reader.getByTestId("year-filter").boundingBox();
  const switchBox = await reader.getByTestId("view-list").boundingBox();
  assert(searchBox && yearBox && switchBox && searchBox.y < switchBox.y && yearBox.y < switchBox.y, "search and year are not above the map/list switch");
  await reader.getByTestId("view-list").click();
  assert(await reader.getByTestId("result-list").isVisible(), "list is hidden on the phone");
  await reader.getByTestId("result-row").first().focus();
  await reader.screenshot({ path: "artifacts/mobile-list.png", fullPage: true });
  await reader.getByTestId("view-map").click();
  assert(await reader.getByTestId("globe-pane").isVisible(), "map is hidden on the phone");
  await reader.screenshot({ path: "artifacts/mobile-map.png", fullPage: true });
  await reader.setViewportSize({ width: 1280, height: 800 });

  const profileHref = await reader.getByTestId("result-row").filter({ hasText: lab }).getAttribute("href");
  assert(profileHref, "result did not link to a profile");
  const beforeCount = Number((await reader.getByTestId("pin-lausanne-switzerland").getAttribute("aria-label"))?.match(/(\d+)/)?.[1]);

  await owner.goto(`${base}/profile`);
  const row = owner.getByTestId("managed-experience").filter({ hasText: lab });
  const editHref = await row.getByRole("link", { name: "Edit" }).getAttribute("href");
  await row.getByTestId("hide-experience").click();
  await owner.getByText("Private").waitFor();

  await reader.reload();
  await reader.getByTestId("search").fill(lab);
  await reader.getByTestId("year-filter").selectOption("2023");
  await reader.getByText("No shared experiences match.").waitFor();
  const afterCount = await reader.getByTestId("pin-lausanne-switzerland").count();
  assert(afterCount === 0 && beforeCount >= 1, "the city pin was still listed after the lab was hidden");
  await reader.goto(`${base}${profileHref}`);
  await reader.getByRole("heading", { name: "Not in the atlas" }).waitFor();
  await reader.goto(`${base}${editHref}`);
  await reader.getByRole("heading", { name: "Not in the atlas" }).waitFor();

  const signedOut = await browser.newContext();
  const stranger = await signedOut.newPage();
  await stranger.goto(`${base}/explore`);
  await stranger.getByTestId("landing-headline").waitFor();
  await stranger.getByTestId("email-input").fill("person@gmail.com");
  await stranger.getByTestId("continue-yale").click();
  await stranger.getByText("exact yale.edu domain").waitFor();
  await signedOut.close();

  console.log("browser checks passed");
} finally {
  await ownerContext.close().catch(() => undefined);
  await readerContext.close().catch(() => undefined);
  await browser.close();
  await deleteUser(ownerEmail);
  await deleteUser(readerEmail);
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
