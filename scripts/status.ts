// Print every chore of a night: npx tsx scripts/status.ts [nightId]
import { temporal } from "../src/temporal/client.js";
import { stateQuery } from "../src/temporal/workflows.js";

const client = await temporal();
let night = process.argv[2];
if (!night) {
  for await (const w of client.workflow.list({ query: "WorkflowType = 'nightWorkflow'" })) {
    night = w.workflowId;
    break;
  }
}
const time = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
for await (const w of client.workflow.list({ query: `WorkflowType = 'choreWorkflow' AND WorkflowId STARTS_WITH '${night}--'` })) {
  const s = await client.workflow.getHandle(w.workflowId).query(stateQuery).catch((err) => {
    console.log(`\n${w.workflowId}: cannot read (${err.details ?? err.message})`);
  });
  if (!s) continue;
  console.log(`\n${s.choreId}: ${s.status}${s.summary ? " · " + s.summary : ""}`);
  for (const l of s.log) console.log(`  ${time(l.at)} ${l.text}`);
}
process.exit(0);
