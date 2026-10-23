import "server-only";
import "./env";
import { Client, Connection, WorkflowNotFoundError } from "@temporalio/client";
import { defaultPayloadConverter } from "@temporalio/common";
import { chores } from "../../src/chores";
import type { ChoreState, NightInput } from "../../src/temporal/workflows";

// Same names the worker registers (src/temporal). Strings keep the workflow code out of this bundle.
export const TASK_QUEUE = "sloth-errands";
const STATE_QUERY = "state";
const DECISION_SIGNAL = "decision";

let client: Promise<Client> | undefined;
export function temporal() {
  client ??= Connection.connect({ address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233" }).then(
    (connection) => new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE ?? "default" }),
  );
  return client;
}

export type BoardChore = {
  choreId: string;
  title: string;
  site: string;
  workflowId: string;
  // null when the worker is off and the chore is still open, so nobody can answer the query
  state: ChoreState | null;
};

export type Night = {
  id: string;
  startedAt: number;
  running: boolean;
  wakeAt: number;
  giveUpAt: number;
  demo: boolean;
  userSub?: string;
};

export type Board = {
  night: Night | null;
  chores: BoardChore[];
  catalog: { id: string; title: string; site: string; risky: boolean }[];
};

export const catalog = chores.map((c) => ({ id: c.id, title: c.title, site: c.site, risky: !!c.risky }));

// The night's input never changes, so read it from history once per night
const inputs = new Map<string, NightInput>();
async function nightInput(c: Client, id: string) {
  let input = inputs.get(id);
  if (!input) {
    const history = await c.workflow.getHandle(id).fetchHistory();
    const payload = history.events?.[0]?.workflowExecutionStartedEventAttributes?.input?.payloads?.[0];
    input = payload ? defaultPayloadConverter.fromPayload<NightInput>(payload) : { choreIds: [] };
    inputs.set(id, input);
  }
  return input;
}

export async function readNight(c: Client, id: string): Promise<Night | null> {
  try {
    const d = await c.workflow.getHandle(id).describe();
    const input = await nightInput(c, id);
    const startedAt = d.startTime.getTime();
    const wakeAt = input.wakeAt ?? startedAt + (input.minutesUntilWake ?? 330) * 60_000;
    return {
      id,
      startedAt,
      running: d.status.name === "RUNNING",
      wakeAt,
      giveUpAt: wakeAt + (input.giveUpAfterWakeMin ?? 240) * 60_000,
      demo: !!input.demo,
      userSub: input.userSub,
    };
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) return null;
    throw err;
  }
}

export async function readChore(c: Client, workflowId: string): Promise<ChoreState | null> {
  const handle = c.workflow.getHandle(workflowId);
  try {
    return await handle.query<ChoreState>(STATE_QUERY);
  } catch {
    // A finished chore returns its final state, which needs no worker
    const d = await handle.describe().catch(() => null);
    if (d && d.status.name === "COMPLETED") return handle.result();
    // Terminated or timed out by hand: there is no state left to read
    if (d && d.status.name !== "RUNNING") {
      const choreId = workflowId.split("--")[1] ?? workflowId;
      return { choreId, status: "failed", summary: `Stopped: ${d.status.name.toLowerCase().replace("_", " ")}`, log: [], attempts: 0 };
    }
    return null;
  }
}

export async function loadBoard(): Promise<Board> {
  const c = await temporal();
  let nightId: string | undefined;
  for await (const w of c.workflow.list({ query: "WorkflowType = 'nightWorkflow'" })) {
    nightId = w.workflowId;
    break;
  }
  if (!nightId) return { night: null, chores: [], catalog };

  const night = await readNight(c, nightId);
  const ids: string[] = [];
  for await (const w of c.workflow.list({
    query: `WorkflowType = 'choreWorkflow' AND WorkflowId STARTS_WITH '${nightId}--'`,
  })) {
    ids.push(w.workflowId);
  }
  const rows = await Promise.all(
    ids.map(async (workflowId): Promise<BoardChore> => {
      const choreId = workflowId.slice(nightId.length + 2);
      const chore = catalog.find((x) => x.id === choreId);
      return {
        choreId,
        title: chore?.title ?? choreId,
        site: chore?.site ?? "",
        workflowId,
        state: await readChore(c, workflowId),
      };
    }),
  );
  // Keep the order of the chore list, not the order Temporal lists them
  rows.sort((a, b) => catalog.findIndex((x) => x.id === a.choreId) - catalog.findIndex((x) => x.id === b.choreId));
  return { night, chores: rows, catalog };
}

export async function startNight(input: NightInput) {
  const c = await temporal();
  const id = `night-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
  await c.workflow.start("nightWorkflow", { taskQueue: TASK_QUEUE, workflowId: id, args: [input] });
  return id;
}

export async function sendDecision(workflowId: string, decision: "approve" | "deny") {
  const c = await temporal();
  await c.workflow.getHandle(workflowId).signal(DECISION_SIGNAL, decision);
}

export async function loadChore(workflowId: string) {
  const c = await temporal();
  const nightId = workflowId.split("--")[0];
  const choreId = workflowId.slice(nightId.length + 2);
  const night = await readNight(c, nightId);
  const chore = catalog.find((x) => x.id === choreId);
  if (!night || !chore) return null;
  const row: BoardChore = { choreId, title: chore.title, site: chore.site, workflowId, state: await readChore(c, workflowId) };
  return { night, chore: row };
}
