// Workflows: the overnight plan. Temporal keeps this state on disk, so a chore can wait
// hours for the user to wake up and survives the worker or the laptop restarting.
import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineSignal,
  executeChild,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from "@temporalio/workflow";

const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
import type * as activities from "./activities.js";
import { findChore } from "../chores.js";
import type { ChoreResult } from "../agent/run-chore.js";

export type Timing = {
  // all in ms
  retryEvery: number; // first retry gap for a site that is down (doubles each time)
  pollEvery: number; // how often to look again when something is not ready yet
  askAgainEvery: number; // gap between approval pushes if one expires unanswered
};

const min = 60_000;
export const realTiming: Timing = { retryEvery: 15 * min, pollEvery: 15 * min, askAgainEvery: 15 * min };
export const demoTiming: Timing = { retryEvery: 20_000, pollEvery: 30_000, askAgainEvery: min };

export type ChoreInput = {
  choreId: string;
  wakeAt: number; // when the user is up and can be asked (epoch ms)
  giveUpAt: number; // stop trying after this
  userSub?: string; // Auth0 user to send the approval push to
  timing: Timing;
};

export type LogLine = { at: number; text: string };
export type ChoreState = {
  choreId: string;
  status: "running" | "retrying" | "waiting" | "asking" | "done" | "denied" | "failed" | "gave_up";
  summary: string;
  proposal?: ChoreResult["proposal"];
  log: LogLine[];
  attempts: number;
};

export const decisionSignal = defineSignal<["approve" | "deny"]>("decision");
export const stateQuery = defineQuery<ChoreState>("state");

const choreActs = (timing: Timing) =>
  proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    heartbeatTimeout: "1 minute",
    // A site being down is retried by the workflow below, so it shows in the chore log
    retry: { initialInterval: "30 seconds", backoffCoefficient: 2, maximumAttempts: 5, nonRetryableErrorTypes: ["SiteDown"] },
  });

const { requestApproval, checkApproval } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { initialInterval: "5 seconds", maximumAttempts: 5 },
});

export async function choreWorkflow(input: ChoreInput): Promise<ChoreState> {
  const state: ChoreState = { choreId: input.choreId, status: "running", summary: "", log: [], attempts: 0 };
  const log = (text: string) => state.log.push({ at: Date.now(), text });
  let decision: "approve" | "deny" | undefined;
  setHandler(stateQuery, () => state);
  setHandler(decisionSignal, (d) => {
    decision ??= d;
  });

  const { prepareChore, doApprovedStep } = choreActs(input.timing);
  const finish = (status: ChoreState["status"], summary: string) => {
    state.status = status;
    state.summary = summary;
    log(summary);
    return state;
  };

  // 1. Do the chore. Not ready yet (booking closed)? Look again later.
  let result: ChoreResult;
  let siteDownTries = 0;
  for (;;) {
    state.attempts++;
    log(state.attempts === 1 ? "Started" : `Trying again (${state.attempts})`);
    try {
      result = await prepareChore(input.choreId);
    } catch (err: any) {
      if (err?.cause?.type === "SiteDown" && siteDownTries < 5 && Date.now() < input.giveUpAt) {
        siteDownTries++;
        const wait = input.timing.retryEvery * 2 ** (siteDownTries - 1);
        state.status = "retrying";
        log(`Site did not answer. Retry ${siteDownTries} of 5 at ${clock(Date.now() + wait)}`);
        await sleep(wait);
        continue;
      }
      return finish("failed", `Gave up after retries: ${err?.cause?.message ?? err?.message ?? "unknown error"}`);
    }
    if (result.outcome !== "not_ready") break;
    // Only chores that wait for something (a booking opening) may come back later
    if (!findChore(input.choreId).pollEveryMin) return finish("done", result.summary);
    if (Date.now() > input.giveUpAt) return finish("gave_up", `Still not ready: ${result.summary}`);
    state.status = "waiting";
    log(`Not ready: ${result.summary}`);
    await sleep(input.timing.pollEvery);
    state.status = "running";
  }

  if (result.outcome === "done") return finish("done", result.summary);
  if (result.outcome === "failed" || !result.proposal) return finish("failed", result.summary);

  // 2. Risky step: hold it until the user is awake, then ask.
  state.proposal = result.proposal;
  state.status = "waiting";
  log(`Held for your OK: ${result.proposal.summary}`);
  const untilWake = input.wakeAt - Date.now();
  if (untilWake > 0) await condition(() => decision !== undefined, untilWake);

  while (decision === undefined && Date.now() < input.giveUpAt) {
    state.status = "asking";
    if (input.userSub) {
      try {
        const req = await requestApproval(input.userSub, result.proposal.summary);
        log("Sent the approval request to your phone");
        // Push requests live 5 minutes. Poll Auth0, but also take an answer from the app.
        const until = Date.now() + req.expiresIn * 1000;
        while (decision === undefined && Date.now() < until) {
          await condition(() => decision !== undefined, `${req.interval || 5} seconds`);
          if (decision !== undefined) break;
          const answer = await checkApproval(req.authReqId);
          if (answer === "approved") decision = "approve";
          else if (answer === "denied") decision = "deny";
          else if (answer === "expired") break;
        }
      } catch (err: any) {
        log(`Could not send the push: ${err?.cause?.message ?? err?.message}. Waiting for an answer in the app.`);
      }
    }
    if (decision === undefined) {
      state.status = "waiting";
      const line = input.userSub ? "No answer yet. Asking again later." : "Waiting for your answer in the app";
      if (state.log.at(-1)?.text !== line) log(line);
      await condition(() => decision !== undefined, input.timing.askAgainEvery);
    }
  }

  if (decision === undefined) return finish("gave_up", "No answer in time, so nothing was done.");
  if (decision === "deny") return finish("denied", "You said no, so nothing was done.");

  // 3. Approved: do exactly that step.
  log("You approved it");
  state.status = "running";
  try {
    const after = await doApprovedStep(input.choreId, result.proposal);
    return finish(after.outcome === "done" ? "done" : "failed", after.summary);
  } catch (err: any) {
    return finish("failed", `Approved step failed: ${err?.cause?.message ?? err?.message}`);
  }
}

export type NightInput = {
  choreIds: string[];
  wakeAt?: number;
  minutesUntilWake?: number; // used by schedules, where the start time is not known ahead
  giveUpAfterWakeMin?: number;
  userSub?: string;
  demo?: boolean;
};

// One night: every chore runs side by side as its own child workflow.
export async function nightWorkflow(input: NightInput) {
  if (!input.choreIds.length) throw ApplicationFailure.nonRetryable("No chores");
  const wakeAt = input.wakeAt ?? Date.now() + (input.minutesUntilWake ?? 330) * 60_000;
  const giveUpAt = wakeAt + (input.giveUpAfterWakeMin ?? 240) * 60_000;
  const timing = input.demo ? demoTiming : realTiming;
  const night = workflowInfo().workflowId;
  const results = await Promise.all(
    input.choreIds.map((choreId) =>
      executeChild(choreWorkflow, {
        workflowId: `${night}--${choreId}`,
        args: [{ choreId, wakeAt, giveUpAt, userSub: input.userSub, timing }],
      }),
    ),
  );
  return results.map((r) => ({ choreId: r.choreId, status: r.status, summary: r.summary }));
}
