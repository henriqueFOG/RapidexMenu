import { readFileSync, writeFileSync } from "node:fs";

const path = "app/api/webhooks/whatsapp/route.ts";
let source = readFileSync(path, "utf8");

const entitlementImport = 'import { hasCommercialFeature } from "@/lib/entitlements";';
if (!source.includes(entitlementImport)) {
  source = source.replace(
    'import { DEMO_RESTAURANT_ID, ensureDemoData } from "@/lib/demo-data";\n',
    `import { DEMO_RESTAURANT_ID, ensureDemoData } from "@/lib/demo-data";\n${entitlementImport}\n`,
  );
}

const marker = [
  '  if (conversation.status === "human") return;',
  '',
  '  const draft = await getWhatsAppDraft(db, restaurantId, customer.id, conversation.id);',
].join("\n");

const replacement = [
  '  if (conversation.status === "human") return;',
  '',
  '  const commercialState = await db.prepare(',
  '    "SELECT plan, status, trial_ends_at FROM restaurants WHERE id = ? LIMIT 1",',
  '  ).bind(restaurantId).first<{',
  '    plan: "start" | "growth" | "scale";',
  '    status: string;',
  '    trial_ends_at: number | null;',
  '  }>();',
  '  const whatsappEntitled = Boolean(commercialState && hasCommercialFeature({',
  '    plan: commercialState.plan,',
  '    restaurantStatus: commercialState.status,',
  '    trialEndsAt: commercialState.trial_ends_at,',
  '  }, "whatsapp_connection"));',
  '  if (!whatsappEntitled) {',
  '    // Preserve inbound history and provider status events, but stop paid bot',
  '    // automation immediately after entitlement loss.',
  '    await db.prepare("UPDATE conversations SET status = \'human\', updated_at = ? WHERE id = ?")',
  '      .bind(Date.now(), conversation.id)',
  '      .run();',
  '    return;',
  '  }',
  '',
  '  const draft = await getWhatsAppDraft(db, restaurantId, customer.id, conversation.id);',
].join("\n");

if (!source.includes('const whatsappEntitled = Boolean(')) {
  if (!source.includes(marker)) throw new Error("WhatsApp entitlement insertion marker not found");
  source = source.replace(marker, replacement);
}

writeFileSync(path, source);
