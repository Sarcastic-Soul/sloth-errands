// One browser per chore run. Each site gets its own saved login:
// a Browserbase context in the cloud, or a Chrome profile folder when testing locally.
import { browserbase, localBrowser, Stagehand } from "@browserbasehq/stagehand";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, need, repoRoot } from "../lib/env.js";

export type BrowserRun = {
  stagehand: Stagehand;
  page: Awaited<ReturnType<typeof firstPage>>;
  sessionUrl?: string;
  close: () => Promise<void>;
};

async function firstPage(browser: { context: { pages(): Promise<any[]> | any[] } }) {
  const pages = await browser.context.pages();
  return pages[0];
}

export async function openBrowser(opts: { site: string; contextId?: string; headless?: boolean }): Promise<BrowserRun> {
  const model = { modelName: env.model as `groq/${string}`, apiKey: need("GROQ_API_KEY") };

  if (env.browser === "browserbase") {
    const browser = await browserbase.launch({
      apiKey: need("BROWSERBASE_API_KEY"),
      projectId: need("BROWSERBASE_PROJECT_ID"),
      timeout: 15 * 60,
      browserSettings: opts.contextId ? { context: { id: opts.contextId, persist: true } } : undefined,
      userMetadata: { app: "sloth-errands", site: opts.site },
    } as any);
    const stagehand = await Stagehand.create({ browser, model } as any);
    const sessionId = (browser as any).sessionId ?? (browser as any).id;
    return {
      stagehand,
      page: await firstPage(browser as any),
      sessionUrl: sessionId ? `https://www.browserbase.com/sessions/${sessionId}` : undefined,
      close: async () => {
        await stagehand.close().catch(() => {});
        await (browser as any).close?.().catch(() => {});
      },
    };
  }

  const userDataDir = resolve(repoRoot, ".browser-data", opts.site);
  mkdirSync(userDataDir, { recursive: true });
  const browser = await localBrowser.launch({
    userDataDir,
    preserveUserDataDir: true,
    headless: opts.headless ?? process.env.SLOTH_HEADLESS !== "0",
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  } as any);
  const stagehand = await Stagehand.create({ browser, model } as any);
  // Chrome flushes its cookie file lazily, so keep the saved login in our own file too
  const cookieFile = resolve(repoRoot, ".sloth", `cookies-${opts.site}.json`);
  const context = (browser as any).context;
  if (existsSync(cookieFile)) await context.addCookies(JSON.parse(readFileSync(cookieFile, "utf8")));
  return {
    stagehand,
    page: await firstPage(browser as any),
    close: async () => {
      mkdirSync(resolve(repoRoot, ".sloth"), { recursive: true });
      writeFileSync(cookieFile, JSON.stringify(await context.cookies().catch(() => [])));
      await stagehand.close().catch(() => {});
      await (browser as any).close?.().catch(() => {});
    },
  };
}
