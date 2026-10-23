// Lists recent Browserbase sessions with their replay links (proof the agent drove cloud browsers).
import Browserbase from "@browserbasehq/sdk";
import { need } from "../src/lib/env.js";

const since = process.argv[2] ? new Date(process.argv[2]).getTime() : 0;
const bb = new Browserbase({ apiKey: need("BROWSERBASE_API_KEY") });
const sessions = await bb.sessions.list();
for (const s of sessions) {
  if (new Date(s.createdAt).getTime() < since) continue;
  const secs = s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000) : "?";
  console.log(`${s.createdAt}  ${s.status}  ${secs}s  https://www.browserbase.com/sessions/${s.id}`);
}
