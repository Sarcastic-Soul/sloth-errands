# Sloth Errands — plan

Hacktoberfest 2026 DEV challenge, Week 3 "Slow and Steady". Deadline Sun Oct 25 2026, 12:29 PM IST.
Tracks: Browserbase, Temporal, Auth0 for AI Agents, Mastra. Runs locally; proof is a demo video.

## The idea

You list boring web chores before bed. Overnight an agent built on an open-weight model does them in
cloud browsers. Safe chores finish on their own. Risky steps (pay, cancel, submit) stop and wait;
in the morning your phone gets an Auth0 Guardian push, you tap Approve, and the chore finishes.

## Pieces

| Part | Tool |
|---|---|
| Web app (chores, run log, approve page) | Next.js 16 + Tailwind, run with bun |
| Login + morning approval | Auth0: `@auth0/nextjs-auth0` login, CIBA (`/bc-authorize`) with Guardian push |
| Agent | Mastra agent, model `openai/gpt-oss-120b` on Groq |
| Browser | Stagehand on Browserbase, one saved context per site |
| Durable runs | Temporal TypeScript SDK, local dev server with SQLite file |
| Storage | SQLite + Drizzle (chores, rules, run log) |
| Demo sites | Small local server (library, gym, fines), reached by Browserbase through a cloudflared quick tunnel |

The worker runs on Node (Temporal's SDK has native modules and does not support Bun). bun is the
package manager and runs the scripts.

## How one chore runs

1. A Temporal Schedule starts `choreWorkflow` at night (or "Run now" in the app for the demo).
2. Activity `prepareChore`: open a Browserbase session with the site's context, Mastra agent works
   through the chore with browser tools. Risky tools are not real: `proposeRiskyAction` only records
   what it would do and ends the run.
3. Safe chore: done, write the result.
4. Risky chore: workflow sleeps until the user's wake time (default 7:30 AM), then activity
   `requestApproval` sends a CIBA push (expiry max 300 s for push). Workflow polls `checkApproval`
   every 5 s. Expired: retry every 15 min, up to 4 times. Also accepts an `approve`/`deny` signal
   from the app's approve page (Auth0 login required).
5. Approved: activity `executeApprovedAction` opens the same context and does only that action.
   Denied or no answer by noon: cancel and log why.

Failures: activities retry with backoff; a site down at 2 AM is retried at 2:15 and so on.

## Demo chores

1. Library (demo site): renew any book due in the next 3 days. Safe.
2. Gym (demo site): book the 7 AM slot for tomorrow once booking opens. Safe.
3. Real public site, no login: check a status / price page and report what changed. Safe.
4. Library fines (demo site): pay a fine. Risky, needs approval.

## Auth0 setup still needed (dashboard)

- Security > Multi-factor Auth: turn on "Push Notification using Auth0 Guardian", policy "Always"
  for now so the first login enrolls the phone. CIBA fails without MFA.
- Install Auth0 Guardian on the phone.

## Build order

1. Repo, scaffold, env loading from `../.env`.
2. Demo sites + tunnel script.
3. Stagehand + Mastra agent on one chore, run directly (no Temporal).
4. Temporal workflow, worker, schedule, CIBA activities.
5. Web app: after the user picks one of 3 design options.
6. Full overnight run (shortened clock) recorded for the video.
7. README, POST.md draft, demo video.

## Limits

- Browserbase free: 1 browser hour a month, 15-minute sessions. Test agent logic against the demo
  sites with a local browser first (Stagehand `env: "LOCAL"`), use Browserbase for real runs.
- Groq free tier rate limits. Fallback models: `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`.
- CIBA push expires in 5 minutes at most, so the push is sent at wake time, not at 2 AM.
