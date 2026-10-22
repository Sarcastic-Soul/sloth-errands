import { Client, Connection } from "@temporalio/client";
import { env } from "../lib/env.js";

let client: Client | undefined;
export async function temporal() {
  client ??= new Client({
    connection: await Connection.connect({ address: env.temporalAddress }),
    namespace: env.temporalNamespace,
  });
  return client;
}
