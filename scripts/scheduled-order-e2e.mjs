// Reuse the tenant created by scripts/hmg-e2e.mjs so this suite validates
// scheduled-order concurrency without consuming an additional signup slot.
await import("./scheduled-order-e2e-reuse.mjs");
