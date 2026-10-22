// Run one chore directly, without Temporal. For testing the agent.
//   npx tsx scripts/try-chore.ts renew-books
import { findChore } from "../src/chores.js";
import { runChore } from "../src/agent/run-chore.js";
import { loadContexts } from "../src/lib/contexts.js";

const chore = findChore(process.argv[2] ?? "renew-books");
const approve = process.argv.includes("--approve");
const t0 = Date.now();
const onStep = (s: string) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);
const contextId = loadContexts()[chore.site];

const first = await runChore(chore, { contextId, onStep });
console.log(JSON.stringify({ outcome: first.outcome, summary: first.summary, proposal: first.proposal }, null, 2));

if (approve && first.proposal) {
  console.log("Approving and running the held step...");
  const second = await runChore(chore, { contextId, approvedAction: first.proposal, onStep });
  console.log(JSON.stringify({ outcome: second.outcome, summary: second.summary }, null, 2));
}
process.exit(0);
