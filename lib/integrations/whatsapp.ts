import { HttpError } from "../http";
import { getBindings } from "../runtime";
import { getWhatsAppAccessTokenByPhoneNumberId } from "../whatsapp-connection";

function graphBase() {
  const version = getBindings().WHATSAPP_GRAPH_VERSION || "v25.0";
  return `https://graph.facebook.com/${version}`;
}

async function credentials(phoneNumberId?: string) {
  const bindings = getBindings();
  if (phoneNumberId) {
    const tenantToken = await getWhatsAppAccessTokenByPhoneNumberId(phoneNumberId);
    if (tenantToken) return { accessToken: tenantToken, phoneNumberId };
  }
  if (
    bindings.RAPIDEX_AUTH_MODE === "hmg-access-code" &&
    bindings.WHATSAPP_ACCESS_TOKEN &&
    bindings.WHATSAPP_PHONE_NUMBER_ID &&
    (!phoneNumberId || phoneNumberId === bindings.WHATSAPP_PHONE_NUMBER_ID)
  ) {
    return { accessToken: bindings.WHATSAPP_ACCESS_TOKEN, phoneNumberId: bindings.WHATSAPP_PHONE_NUMBER_ID };
  }
  throw new HttpError(503, "WhatsApp ainda não configurado para esta loja.", "integration_not_configured");
}

export async function sendWhatsAppText(to: string, body: string, phoneNumberId?: string) {
  const credential = await credentials(phoneNumberId);
  const response = await fetch(`${graphBase()}/${encodeURIComponent(credential.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.accessToken}`,
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

export async function downloadWhatsAppMedia(mediaId: string, phoneNumberId?: string) {
  const credential = await credentials(phoneNumberId);
  const metadataResponse = await fetch(`${graphBase()}/${encodeURIComponent(mediaId)}`, {
    headers: { authorization: `Bearer ${credential.accessToken}` },
  });
  if (!metadataResponse.ok) {
    throw new HttpError(502, "Não foi possível obter a mídia do WhatsApp.", "media_download_failed");
  }
  const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string };
  if (!metadata.url) throw new HttpError(502, "URL de mídia ausente.", "media_download_failed");

  const mediaResponse = await fetch(metadata.url, {
    headers: { authorization: `Bearer ${credential.accessToken}` },
  });
  if (!mediaResponse.ok) {
    throw new HttpError(502, "Não foi possível baixar a mídia.", "media_download_failed");
  }
  return {
    blob: await mediaResponse.blob(),
    mimeType: metadata.mime_type || mediaResponse.headers.get("content-type") || "application/octet-stream",
  };
}
