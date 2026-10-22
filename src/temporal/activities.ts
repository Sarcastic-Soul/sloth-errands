// Activities: the parts of a chore that touch the outside world.
// Temporal retries them when they fail, so a flaky site or a rate limit is not fatal.
import { ApplicationFailure, Context, heartbeat } from "@temporalio/activity";
import { findChore } from "../chores.js";
import { runChore, SiteDownError, type ChoreResult } from "../agent/run-chore.js";
import { loadContexts } from "../lib/contexts.js";
import * as ciba from "../lib/ciba.js";

async function run(choreId: string, approvedAction?: { action: string; url: string }): Promise<ChoreResult> {
  const chore = findChore(choreId);
  const beat = setInterval(() => heartbeat(), 10_000);
  try {
    return await runChore(chore, {
      contextId: loadContexts()[chore.site],
      approvedAction,
      isRetry: Context.current().info.attempt > 1,
    });
  } catch (err: any) {
    if (err instanceof SiteDownError) throw ApplicationFailure.retryable(err.message, "SiteDown");
    if (/rate limit/i.test(err?.message ?? "")) throw ApplicationFailure.retryable("Model rate limit", "RateLimit");
    throw err;
  } finally {
    clearInterval(beat);
  }
}

export async function prepareChore(choreId: string) {
  return run(choreId);
}

export async function doApprovedStep(choreId: string, approved: { action: string; url: string }) {
  return run(choreId, approved);
}

export async function requestApproval(userSub: string, message: string) {
  return ciba.startApproval(userSub, message);
}

export async function checkApproval(authReqId: string) {
  return ciba.checkApproval(authReqId);
}
