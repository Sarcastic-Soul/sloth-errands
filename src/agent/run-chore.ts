// Runs one chore with a Mastra agent driving a Stagehand browser.
// The agent can read pages and click, but anything that looks like paying, cancelling or
// submitting is blocked unless that exact step was approved. It can only propose it.
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { Chore } from "../chores.js";
import { env } from "../lib/env.js";
import { openBrowser } from "./browser.js";

// Steps that commit money or can't be undone. Opening a "Pay fine" page is fine; confirming it is not.
const RISKY = /\b(confirm|pay now|purchase|buy now|checkout|place order|submit order|delete|unsubscribe|transfer|cancel (my )?(membership|subscription|order|booking))\b/i;

export type Outcome = "done" | "not_ready" | "needs_approval" | "failed";

export type ChoreResult = {
  outcome: Outcome;
  summary: string;
  proposal?: { action: string; summary: string; amount?: string; url: string };
  siteDown?: boolean;
  steps: string[];
  sessionUrl?: string;
};

export class SiteDownError extends Error {}

export async function runChore(
  chore: Chore,
  opts: { contextId?: string; approvedAction?: { action: string; url: string }; onStep?: (s: string) => void } = {},
): Promise<ChoreResult> {
  const steps: string[] = [];
  const step = (s: string) => {
    steps.push(s);
    opts.onStep?.(s);
  };
  let finished: { outcome: Outcome; summary: string } | undefined;
  let proposal: ChoreResult["proposal"];
  let siteDown = false;
  let approvedUsed = false;

  const run = await openBrowser({ site: chore.site, contextId: opts.contextId });
  try {
    const startUrl = opts.approvedAction?.url ?? chore.url ?? env.demoBaseUrl + chore.path;

    const readPage = async () => {
      const text: string = await run.page.evaluate(() => {
        // Keep pages small: free-tier Groq allows 8k tokens a minute
        const root = (document.querySelector("main") ?? document.body) as HTMLElement;
        const body = root.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 2500);
        const controls = [...root.querySelectorAll("button, a, input[type=submit]")]
          .map((el) => (el as HTMLElement).innerText?.trim() || (el as HTMLInputElement).value)
          .filter(Boolean)
          .slice(0, 25);
        return `${body}\n\nButtons and links: ${controls.join(" | ")}`;
      });
      return `URL: ${await run.page.url()}\n${text}`;
    };

    const openPage = createTool({
      id: "open_page",
      description: "Open a URL (or a path on the same site) and return the page text.",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        const target = url.startsWith("http") ? url : new URL(url, startUrl).toString();
        const res = await run.page.goto(target);
        const status = res?.status() ?? 200;
        step(`Opened ${target} (${status})`);
        if (status >= 500) {
          siteDown = true;
          return { error: `The site answered ${status}. It is down right now; finish with outcome failed.` };
        }
        return { page: await readPage() };
      },
    });

    const readCurrent = createTool({
      id: "read_page",
      description: "Return the text of the current page.",
      inputSchema: z.object({}),
      execute: async () => ({ page: await readPage() }),
    });

    const click = createTool({
      id: "do_on_page",
      description:
        "Do one thing on the current page, described in plain words, e.g. 'click the Renew button next to The Overstory'. Returns the page after.",
      inputSchema: z.object({ instruction: z.string() }),
      execute: async ({ instruction }) => {
        const found = await run.stagehand.observe(instruction);
        const action = found.data[0];
        if (!action) return { error: "Could not find that on the page." };
        const what = `${instruction} / ${action.description}`;
        if (RISKY.test(what)) {
          const allowed = opts.approvedAction && !approvedUsed;
          if (!allowed) {
            step(`Blocked risky step: ${action.description}`);
            return { error: "This step is risky (pay, cancel, confirm or similar). Do not do it. Call propose_risky_action instead." };
          }
          approvedUsed = true;
          step(`Approved step: ${action.description}`);
        }
        await run.stagehand.act(action);
        step(`Did: ${action.description}`);
        return { page: await readPage() };
      },
    });

    const propose = createTool({
      id: "propose_risky_action",
      description: "Record a risky step (paying, cancelling, submitting) for the user to approve in the morning. Does not do it.",
      inputSchema: z.object({
        action: z.string().describe("The exact step to take later, e.g. 'click Confirm payment of ₹50'"),
        summary: z.string().describe("One short sentence for the user"),
        amount: z.string().optional(),
      }),
      execute: async (input) => {
        if (!chore.risky) return { error: "This chore is not allowed to propose risky steps. Finish instead." };
        proposal = { ...input, url: await run.page.url() };
        step(`Proposed for approval: ${input.action}`);
        return { ok: "Recorded. Now call finish with outcome needs_approval." };
      },
    });

    const finish = createTool({
      id: "finish",
      description: "End the chore and report what happened.",
      inputSchema: z.object({
        outcome: z.enum(["done", "not_ready", "needs_approval", "failed"]),
        summary: z.string().describe("One or two plain sentences for the user"),
      }),
      execute: async (input) => {
        finished = input;
        return { ok: "Finished." };
      },
    });

    const agent = new Agent({
      id: "sloth",
      name: "Sloth",
      model: env.model,
      instructions: `You do one web chore for the user while they sleep. Work step by step with the tools.
Today is ${new Date().toDateString()}. Never guess a year that the page does not show.
Rules:
- You are already signed in to the user's accounts. Never type passwords.
- Use do_on_page for one action at a time, then check the page it returns.
- ${opts.approvedAction
        ? `The user has approved exactly one risky step: "${opts.approvedAction.action}". Do that step with do_on_page. Do no other risky step.`
        : "Never pay, cancel, confirm or delete anything yourself. If the chore needs that, call propose_risky_action and stop."}
- Always end by calling finish. Use not_ready if the thing you need is not available yet, failed if the site does not work.
- Do only what the chore asks. After each action, read the page notice to check it worked.
- Keep summaries short and specific: titles, dates, amounts.`,
      // After approval the agent can no longer propose; it can only do the approved step
      tools: opts.approvedAction
        ? { open_page: openPage, read_page: readCurrent, do_on_page: click, finish }
        : { open_page: openPage, read_page: readCurrent, do_on_page: click, propose_risky_action: propose, finish },
    });

    const prompt = opts.approvedAction
      ? `Chore: ${chore.title}. The user approved this step: "${opts.approvedAction.action}". Start at ${startUrl}, do exactly that step, check it worked, then call finish.`
      : `Chore: ${chore.title}. ${chore.task}\nStart by opening ${startUrl}.`;

    step(`Started: ${chore.title}`);
    const out: any = await agent.generate(prompt, { maxSteps: 16 });
    if (process.env.SLOTH_DEBUG) console.log("agent end:", out.finishReason, JSON.stringify(out.text)?.slice(0, 500));
    if (!finished && !siteDown) {
      // Open models sometimes answer in text instead of calling finish; ask once more
      await agent.generate(
        `You stopped without calling finish. Steps so far:\n${steps.join("\n")}\nYour last message: ${out.text ?? ""}\nCall finish now.`,
        { maxSteps: 2 },
      );
    }

    if (siteDown && finished?.outcome !== "done") throw new SiteDownError(`${chore.site} is down`);
    const outcome = finished?.outcome ?? "failed";
    return {
      outcome: proposal && outcome !== "failed" ? "needs_approval" : outcome,
      summary: finished?.summary ?? "The agent stopped without reporting.",
      proposal,
      steps,
      sessionUrl: run.sessionUrl,
    };
  } finally {
    await run.close();
  }
}
