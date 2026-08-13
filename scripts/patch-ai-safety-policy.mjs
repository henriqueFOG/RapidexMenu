import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/integrations/openai.ts";
let source = readFileSync(path, "utf8");

const safetyImport = 'import { isSafeAiMemory, safeAiProductContext, safeConsumerReply } from "../ai-safety-policy";';
if (!source.includes(safetyImport)) {
  source = source.replace(
    'import { HttpError } from "../http";\n',
    `${safetyImport}\nimport { HttpError } from "../http";\n`,
  );
}

const oldProducts = `products: context.products.map(({ marginPercent, ...product }) => ({\n      ...product,\n      commercialPriority:\n        marginPercent >= 35 ? "preferred" : marginPercent >= 20 ? "standard" : "low_priority",\n    })),`;
if (source.includes(oldProducts)) {
  source = source.replace(oldProducts, "products: safeAiProductContext(context.products),");
}

source = source.replace(
  '.filter((item) => isSafeMemory(item))',
  '.filter((item) => isSafeAiMemory(item))',
);

const returnMarker = `  return {\n    reply: typeof reply.reply === "string" ? reply.reply.slice(0, 3500) : "",`;
if (source.includes(returnMarker)) {
  source = source.replace(
    returnMarker,
    `  const consumerReply = safeConsumerReply(reply.reply);\n  return {\n    reply: consumerReply.reply,`,
  );
}
source = source.replace(
  'requiresHuman: Boolean(reply.requiresHuman),',
  'requiresHuman: Boolean(reply.requiresHuman || consumerReply.forcedHuman),',
);

const memoryFunctionStart = source.indexOf("\nfunction isSafeMemory(");
if (memoryFunctionStart !== -1) {
  const nextFunction = source.indexOf("\nfunction normalizeCheckout", memoryFunctionStart);
  if (nextFunction === -1) throw new Error("normalizeCheckout marker not found after isSafeMemory");
  source = source.slice(0, memoryFunctionStart) + source.slice(nextFunction);
}

writeFileSync(path, source);
