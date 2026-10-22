// Start a night run now.
//   npx tsx scripts/night.ts --demo --wake-in 2        all chores, ask for approval 2 minutes from now
//   npx tsx scripts/night.ts renew-books parcel         only these chores, real timing
import { chores } from "../src/chores.js";
import { temporal } from "../src/temporal/client.js";
import { TASK_QUEUE } from "../src/temporal/shared.js";
import { nightWorkflow } from "../src/temporal/workflows.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const demo = args.includes("--demo");
const wakeIn = Number(flag("--wake-in") ?? (demo ? 2 : 330));
const userSub = flag("--user") ?? process.env.SLOTH_USER_SUB;
const choreIds = args.filter((a) => !a.startsWith("--"));
const ids = choreIds.length ? choreIds : chores.map((c) => c.id);

const client = await temporal();
const id = `night-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
await client.workflow.start(nightWorkflow, {
  taskQueue: TASK_QUEUE,
  workflowId: id,
  args: [{ choreIds: ids, wakeAt: Date.now() + wakeIn * 60_000, userSub, demo }],
});
console.log(`Started ${id}: ${ids.join(", ")}. Wake time in ${wakeIn} min. Watch it at http://localhost:8233`);
process.exit(0);
