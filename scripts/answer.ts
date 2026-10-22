// Approve or deny a held chore from the terminal: npx tsx scripts/answer.ts <workflowId> approve|deny
import { temporal } from "../src/temporal/client.js";
import { decisionSignal } from "../src/temporal/workflows.js";

const [id, answer] = process.argv.slice(2);
if (!id || (answer !== "approve" && answer !== "deny")) throw new Error("Usage: answer.ts <workflowId> approve|deny");
await (await temporal()).workflow.getHandle(id).signal(decisionSignal, answer);
console.log(`Sent ${answer} to ${id}`);
process.exit(0);
