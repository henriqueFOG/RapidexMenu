import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/billing-dunning.ts";
let source = readFileSync(path, "utf8");
const oldBlock = `    } catch {\n      await db.prepare(\n        \`UPDATE billing_dunning_events SET status = 'failed', last_error = 'job_enqueue_failed',\n         last_attempt_at = ? WHERE id = ?\`,\n      ).bind(Date.now(), event.id).run();\n      failed += 1;\n    }`;
const newBlock = `    } catch {\n      // If the queue insert itself failed, no durable job exists to retry. Remove\n      // only the still-sending claim so the next reconciliation cycle can try\n      // to enqueue again. Jobs that reached retry/dead keep their ledger event.\n      await db.prepare(\n        \`DELETE FROM billing_dunning_events WHERE id = ? AND status = 'sending'\`,\n      ).bind(event.id).run();\n      failed += 1;\n    }`;
if (!source.includes(oldBlock)) throw new Error("Dunning enqueue failure marker not found");
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source);
