import { HttpError } from "../http";
import { getBindings } from "../runtime";

function graphBase() {
  const version = getBindings().WHATSAPP_GRAPH_VERSION || "v25.0";
  return `https://graph.facebook.com/${version}`;
}

export async function sendWhatsAppText(to: string, body: string) {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = getBindings();
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new HttpError(503, "WhatsApp ainda não configurado.", "integration_not_configured");
  }
  const response = await fetch(`${graphBase()}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    console.error("WhatsApp send failed", response.status);
    throw new HttpError(502, "WhatsApp não aceitou a mensagem.", "whatsapp_send_failed");
  }
  const messages = payload.messages as Array<{ id?: string }> | undefined;
  return { providerMessageId: messages?.[0]?.id ?? null, payload };
}

export async function downloadWhatsAppMedia(mediaId: string) {
  const { WHATSAPP_ACCESS_TOKEN } = getBindings();
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new HttpError(503, "WhatsApp ainda não configurado.", "integration_not_configured");
  }
  const metadataResponse = await fetch(`${graphBase()}/${encodeURIComponent(mediaId)}`, {
    headers: { authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!metadataResponse.ok) {
    throw new HttpError(502, "Não foi possível obter o áudio do WhatsApp.", "media_download_failed");
  }
  const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string };
  if (!metadata.url) throw new HttpError(502, "URL de mídia ausente.", "media_download_failed");

  const mediaResponse = await fetch(metadata.url, {
    headers: { authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!mediaResponse.ok) {
    throw new HttpError(502, "Não foi possível baixar o áudio.", "media_download_failed");
  }
  return {
    blob: await mediaResponse.blob(),
    mimeType: metadata.mime_type || mediaResponse.headers.get("content-type") || "audio/ogg",
  };
}
