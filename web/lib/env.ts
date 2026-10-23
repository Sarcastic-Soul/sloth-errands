import "server-only";
import { resolve } from "node:path";
import { config } from "dotenv";

// Same file the worker reads. Loaded here too, in case next.config ran in another process.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
