// One-time login for a site, saved for every later run.
//   npx tsx scripts/login.ts library          fill the demo login for you
//   npx tsx scripts/login.ts library --manual  you log in yourself (local window or Browserbase live view)
import Browserbase from "@browserbasehq/sdk";
import { openBrowser } from "../src/agent/browser.js";
import { env, need } from "../src/lib/env.js";
import { loadContexts, saveContext } from "../src/lib/contexts.js";

const site = process.argv[2];
const manual = process.argv.includes("--manual");
const demoLogins: Record<string, { path: string; fields: Record<string, string>; submit: string }> = {
  library: { path: "/library", fields: { "#card": "20260042", "#pin": "1234" }, submit: "form button[type=submit]" },
  gym: { path: "/gym", fields: { "#email": "anish@demo.gym", "#password": "sloth" }, submit: "form button[type=submit]" },
};
const login = demoLogins[site];
if (!login) {
  console.error(`Usage: login.ts <${Object.keys(demoLogins).join("|")}> [--manual]`);
  process.exit(1);
}

let contextId: string | undefined;
if (env.browser === "browserbase") {
  contextId = loadContexts()[site];
  if (!contextId) {
    const bb = new Browserbase({ apiKey: need("BROWSERBASE_API_KEY") });
    contextId = (await bb.contexts.create({ projectId: need("BROWSERBASE_PROJECT_ID") })).id;
    saveContext(site, contextId);
  }
  console.log(`Context for ${site}: ${contextId}`);
}

const run = await openBrowser({ site, contextId, headless: !manual });
await run.page.goto(env.demoBaseUrl + login.path);

if (manual) {
  if (run.sessionUrl) console.log(`Log in through the live view: ${run.sessionUrl}`);
  else console.log("Log in in the Chrome window.");
  console.log("Waiting up to 5 minutes for the login...");
  const until = Date.now() + 5 * 60 * 1000;
  while (Date.now() < until && (await run.page.evaluate(() => !!document.querySelector("input[type=password]")))) {
    await new Promise((r) => setTimeout(r, 2000));
  }
} else if (await run.page.evaluate(() => !!document.querySelector("input[type=password]"))) {
  for (const [selector, value] of Object.entries(login.fields)) await run.page.locator(selector).fill(value);
  await run.page.locator(login.submit).click();
  await new Promise((r) => setTimeout(r, 1500));
}

const signedIn = await run.page.evaluate(() => !document.querySelector("input[type=password]"));
console.log(signedIn ? `Signed in to ${site}. Saved for later runs.` : `Still on the login page for ${site}.`);
// Browserbase saves the context when the session closes; give it a moment
await run.close();
await new Promise((r) => setTimeout(r, 3000));
process.exit(signedIn ? 0 : 1);
