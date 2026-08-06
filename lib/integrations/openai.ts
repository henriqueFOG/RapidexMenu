import { HttpError } from "../http";
import { getBindings } from "../runtime";

export type SalesReply = {
  reply: string;
  intent: "menu" | "repeat" | "order" | "track" | "human";
  suggestedProductIds: string[];
  cartItems: Array<{ productId: string; quantity: number; notes: string }>;
  requiresHuman: boolean;
  memory: Array<{ kind: string; value: string }>;
  decisionReason: string;
};

type SalesContext = {
  restaurantName: string;
  message: string;
  customerName?: string | null;
  preferences: Array<{ kind: string; value: string }>;
  products: Array<{
    id: string;
    name: string;
    description: string;
    priceCents: number;
    marginPercent: number;
    available: boolean;
  }>;
  recentOrders: Array<{ orderNumber: number; items: string[]; totalCents: number }>;
};

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    intent: { type: "string", enum: ["menu", "repeat", "order", "track", "human"] },
    suggestedProductIds: { type: "array", items: { type: "string" } },
    cartItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          productId: { type: "string" },
          quantity: { type: "integer", minimum: 1, maximum: 20 },
          notes: { type: "string" },
        },
        required: ["productId", "quantity", "notes"],
      },
    },
    requiresHuman: { type: "boolean" },
    memory: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { kind: { type: "string" }, value: { type: "string" } },
        required: ["kind", "value"],
      },
    },
    decisionReason: { type: "string" },
  },
  required: [
    "reply",
    "intent",
    "suggestedProductIds",
    "cartItems",
    "requiresHuman",
    "memory",
    "decisionReason",
  ],
} as const;

export async function generateSalesReply(context: SalesContext): Promise<SalesReply> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getBindings();
  if (!OPENAI_API_KEY) return fallbackReply(context);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL || "gpt-5-mini",
      instructions:
        "Você é o vendedor do restaurante no WhatsApp. Responda em português brasileiro, de forma curta, calorosa e objetiva. Nunca invente item, preço, disponibilidade ou status. Só use IDs do cardápio fornecido. Preserve preferências do cliente. Não confirme nem conclua compra sem confirmação explícita. Se houver dúvida, reclamação, alergia, pedido fora do cardápio ou necessidade de reembolso, marque requiresHuman. Sugira no máximo dois itens e preserve margem: não ofereça desconto; prefira itens disponíveis com margem saudável. decisionReason deve explicar em uma frase operacional a decisão, sem raciocínio interno detalhado.",
      input: JSON.stringify(context),
      text: {
        format: {
          type: "json_schema",
          name: "rapidex_sales_reply",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    console.error("OpenAI request failed", response.status, requestId ?? "without-request-id");
    return fallbackReply(context);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const outputText = extractOutputText(payload);
  if (!outputText) return fallbackReply(context);

  try {
    return JSON.parse(outputText) as SalesReply;
  } catch {
    return fallbackReply(context);
  }
}

export async function transcribeAudio(blob: Blob, filename = "pedido.ogg") {
  const { OPENAI_API_KEY, OPENAI_TRANSCRIBE_MODEL } = getBindings();
  if (!OPENAI_API_KEY) {
    throw new HttpError(503, "Transcrição ainda não configurada.", "integration_not_configured");
  }
  if (blob.size > 10 * 1024 * 1024) {
    throw new HttpError(413, "Áudio acima do limite de 10 MB.", "audio_too_large");
  }

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    throw new HttpError(502, "Não foi possível transcrever o áudio.", "transcription_failed");
  }
  const payload = (await response.json()) as { text?: string };
  if (!payload.text) throw new HttpError(502, "Transcrição vazia.", "transcription_failed");
  return payload.text.trim();
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return null;
  for (const item of payload.output as Array<Record<string, unknown>>) {
    if (!Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function fallbackReply(context: SalesContext): SalesReply {
  const normalized = context.message.toLowerCase();
  const wantsRepeat = /de sempre|repetir|igual.*últim/.test(normalized);
  const wantsHuman = /atendente|humano|reclama|cancel|reembolso|alerg/.test(normalized);
  const wantsTrack = /acompanhar|onde.*pedido|status|chega/.test(normalized);
  const best = context.products
    .filter((product) => product.available)
    .sort((left, right) => right.marginPercent - left.marginPercent)[0];

  return {
    reply: wantsHuman
      ? "Vou chamar alguém da equipe para cuidar disso com você agora."
      : wantsTrack
        ? "Me envie o número do pedido para eu consultar o andamento."
        : wantsRepeat && context.recentOrders.length
          ? "Encontrei seu último pedido. Posso repetir os mesmos itens para o endereço habitual?"
          : best
            ? `Posso te mostrar o cardápio. Uma boa pedida hoje é ${best.name}. Quer ver os detalhes?`
            : "Posso te mostrar o cardápio disponível agora.",
    intent: wantsHuman ? "human" : wantsTrack ? "track" : wantsRepeat ? "repeat" : "menu",
    suggestedProductIds: best ? [best.id] : [],
    cartItems: [],
    requiresHuman: wantsHuman,
    memory: [],
    decisionReason: "Resposta segura gerada pelas regras operacionais locais.",
  };
}
