// Sends one test approval push to a user's phone and waits for the answer.
import { startApproval, checkApproval } from "../src/lib/ciba.js";

const sub = process.argv[2];
if (!sub) throw new Error("usage: tsx scripts/ciba-test.ts <auth0 user sub>");
const req = await startApproval(sub, "Sloth Errands test push");
console.log(`Push sent, expires in ${req.expiresIn}s`);
const until = Date.now() + req.expiresIn * 1000;
while (Date.now() < until) {
  await new Promise((r) => setTimeout(r, (req.interval || 5) * 1000));
  const state = await checkApproval(req.authReqId);
  console.log(state);
  if (state !== "pending") break;
}
