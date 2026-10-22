// The worker runs the agent. Start it with `bun run worker` (it runs on Node).
import { NativeConnection, Worker } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import { env } from "../lib/env.js";
import * as activities from "./activities.js";
import { TASK_QUEUE } from "./shared.js";

const connection = await NativeConnection.connect({ address: env.temporalAddress });
const worker = await Worker.create({
  connection,
  namespace: env.temporalNamespace,
  taskQueue: TASK_QUEUE,
  workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
  activities,
  // One chore at a time: browsers are heavy (7.5 GB laptop) and Groq's free tier allows
  // 8k tokens a minute. Nobody is waiting at 2 AM, so slow and steady is fine.
  maxConcurrentActivityTaskExecutions: 1,
});
console.log(`Worker ready on task queue ${TASK_QUEUE} (browser: ${env.browser}, model: ${env.model})`);
await worker.run();
