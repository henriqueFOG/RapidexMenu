export type AiMemory = { kind?: unknown; value?: unknown };

type ProductWithMargin = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  marginPercent: number;
  available: boolean;
};

export function isSafeAiMemory(item: AiMemory) {
  if (typeof item.kind !== "string" || typeof item.value !== "string") return false;
  if (!["ingredient", "product", "delivery", "payment", "note"].includes(item.kind)) return false;
  const value = item.value.trim();
  if (!value || value.length > 120) return false;
  return !/(ignore|ignorar|instruç|system|developer|prompt|senha|secret|token|credencial|margem|custo interno|api[ _-]?key)/i.test(value);
}

export function safeAiProductContext(products: ProductWithMargin[]) {
  return products.map(({ marginPercent, ...product }) => ({
    ...product,
    commercialPriority:
      marginPercent >= 35 ? "preferred" as const : marginPercent >= 20 ? "standard" as const : "low_priority" as const,
  }));
}

export function consumerReplyLeaksInternalContext(value: unknown) {
  if (typeof value !== "string") return false;
  return /(commercialPriority|decisionReason|system\s+(prompt|message)|developer\s+(prompt|message)|prompt\s+interno|instruções?\s+internas?|IDs?\s+internos?|credenciais?|api[ _-]?key|token\s+de\s+acesso|margem\s+(?:de\s+lucro|percentual|interna))/i.test(value);
}

export function safeConsumerReply(value: unknown) {
  const reply = typeof value === "string" ? value.slice(0, 3500) : "";
  if (!reply) return { reply: "", forcedHuman: false };
  if (!consumerReplyLeaksInternalContext(reply)) return { reply, forcedHuman: false };
  return {
    reply: "Vou chamar alguém da equipe para continuar seu atendimento com segurança.",
    forcedHuman: true,
  };
}
