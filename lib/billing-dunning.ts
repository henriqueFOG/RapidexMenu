import { getBindings, getDatabase } from "./runtime";
import { escapeEmailHtml, sendTransactionalEmail, transactionalEmailConfigured } from "./transactional-email";

const RETRY_AFTER_MS = 6 * 60 * 60 * 1000;

type DunningStage = "grace_started" | "grace_24h" | "suspended";

type BillingRow = {
  subscription_id: string;
  restaurant_id: string;
  restaurant_name: string;
  owner_email: string;
  plan: string;
  subscription_status: string;
  next_payment_at: number | null;
  restaurant_status: string;
  access_ends_at: number | null;
};

export async function processBillingDunning(limit = 100) {
  if (!transactionalEmailConfigured()) {
    return { configured: false, candidates: 0, sent: 0, failed: 0 };
  }

  const db = getDatabase();
  const now = Date.now();
  const rows = await db.prepare(
    `SELECT ps.id AS subscription_id, ps.restaurant_id, r.name AS restaurant_name,
            r.owner_email, ps.plan, ps.status AS subscription_status, ps.next_payment_at,
            r.status AS restaurant_status, r.access_ends_at
     FROM platform_subscriptions ps
     JOIN restaurants r ON r.id = ps.restaurant_id
     WHERE ps.provider = 'mercado_pago'
       AND ps.status IN ('pending', 'paused', 'cancelled')
       AND r.owner_email IS NOT NULL
     ORDER BY ps.updated_at ASC
     LIMIT ?`,
  ).bind(Math.max(1, Math.min(250, limit))).all<BillingRow>();

  let candidates = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows.results) {
    const stage = dunningStage(row, now);
    if (!stage) continue;
    candidates += 1;
    const cycleKey = dunningCycleKey(row);
    const event = await claimDunningEvent(row, stage, cycleKey, now);
    if (!event) continue;

    const message = dunningMessage(row, stage);
    let delivered = false;
    try {
      delivered = await sendTransactionalEmail({
        to: row.owner_email,
        subject: message.subject,
        html: message.html,
      });
    } catch {
      delivered = false;
    }

    if (delivered) {
      await db.prepare(
        `UPDATE billing_dunning_events
         SET status = 'sent', sent_at = ?, last_error = NULL, last_attempt_at = ?
         WHERE id = ?`,
      ).bind(Date.now(), Date.now(), event.id).run();
      sent += 1;
    } else {
      await db.prepare(
        `UPDATE billing_dunning_events
         SET status = 'failed', last_error = 'transactional_email_failed', last_attempt_at = ?
         WHERE id = ?`,
      ).bind(Date.now(), event.id).run();
      failed += 1;
    }
  }

  return { configured: true, candidates, sent, failed };
}

function dunningStage(row: BillingRow, now: number): DunningStage | null {
  const accessEndsAt = Number(row.access_ends_at || 0);
  if (row.restaurant_status === "paused" || (accessEndsAt > 0 && accessEndsAt <= now)) {
    return "suspended";
  }
  if (!accessEndsAt || accessEndsAt <= now) return null;
  const remaining = accessEndsAt - now;
  if (remaining <= 24 * 60 * 60 * 1000) return "grace_24h";
  return "grace_started";
}

function dunningCycleKey(row: BillingRow) {
  // Access end is the immutable identifier of a grace/suspension cycle. Fallback
  // to provider next-payment when a future provider cycle is the only reference.
  return String(Math.trunc(Number(row.access_ends_at || row.next_payment_at || 0)));
}

async function claimDunningEvent(row: BillingRow, stage: DunningStage, cycleKey: string, now: number) {
  const retryBefore = now - RETRY_AFTER_MS;
  return getDatabase().prepare(
    `INSERT INTO billing_dunning_events
     (id, subscription_id, restaurant_id, stage, cycle_key, recipient_email, status,
      attempt_count, last_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'sending', 1, ?, ?)
     ON CONFLICT (subscription_id, stage, cycle_key) DO UPDATE SET
       status = 'sending',
       attempt_count = billing_dunning_events.attempt_count + 1,
       last_attempt_at = excluded.last_attempt_at,
       last_error = NULL
     WHERE billing_dunning_events.status = 'failed'
       AND billing_dunning_events.attempt_count < 3
       AND billing_dunning_events.last_attempt_at <= ?
     RETURNING id`,
  ).bind(
    crypto.randomUUID(),
    row.subscription_id,
    row.restaurant_id,
    stage,
    cycleKey,
    row.owner_email,
    now,
    now,
    retryBefore,
  ).first<{ id: string }>();
}

function dunningMessage(row: BillingRow, stage: DunningStage) {
  const baseUrl = String(getBindings().RAPIDEX_PUBLIC_URL || "").replace(/\/$/, "");
  const billingUrl = `${baseUrl || "https://rapidexmenu.com.br"}/assinatura`;
  const restaurant = escapeEmailHtml(row.restaurant_name);
  const plan = escapeEmailHtml(planLabel(row.plan));
  const link = escapeEmailHtml(billingUrl);

  if (stage === "grace_started") {
    return {
      subject: `Pagamento pendente do RapidexMenu · ${row.restaurant_name}`,
      html: shell(
        "Pagamento pendente",
        `<p>Identificamos uma pendência na renovação do plano <b>${plan}</b> de <b>${restaurant}</b>.</p><p>A loja permanece ativa durante o período de tolerância. Regularize a assinatura para evitar interrupção do canal próprio.</p>${button(link, "Regularizar assinatura")}`,
      ),
    };
  }
  if (stage === "grace_24h") {
    return {
      subject: `Ação necessária: acesso do RapidexMenu próximo de ser pausado`,
      html: shell(
        "Último aviso de cobrança",
        `<p>O período de tolerância de <b>${restaurant}</b> está próximo do fim.</p><p>Regularize o plano <b>${plan}</b> para manter cardápio, pedidos e recursos comerciais disponíveis sem interrupção.</p>${button(link, "Regularizar agora")}`,
      ),
    };
  }
  return {
    subject: `RapidexMenu pausado por pendência de assinatura`,
    html: shell(
      "Acesso comercial pausado",
      `<p>O acesso comercial de <b>${restaurant}</b> foi pausado após o término do período de tolerância.</p><p>Regularize a assinatura para reativar a operação. Os dados permanecem preservados conforme as regras da plataforma.</p>${button(link, "Reativar RapidexMenu")}`,
    ),
  };
}

function shell(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#171915"><h1>${escapeEmailHtml(title)}</h1>${body}<p style="margin-top:28px;color:#666;font-size:13px">Mensagem transacional sobre a assinatura do RapidexMenu.</p></div>`;
}

function button(url: string, label: string) {
  return `<p><a href="${url}" style="display:inline-block;background:#171915;color:#c9ff4a;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:700">${escapeEmailHtml(label)}</a></p>`;
}

function planLabel(plan: string) {
  return ({ start: "Começo", growth: "Crescimento", scale: "Escala" } as Record<string, string>)[plan] || plan;
}
