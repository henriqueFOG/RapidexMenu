from pathlib import Path

path = Path("app/loja/[slug]/StoreClient.tsx")
source = path.read_text()

if "type DeliveryQuote =" not in source:
    marker = "type CartEntry = Product & {\n"
    insert = '''type DeliveryQuote = {
  zoneName: string | null;
  matched: boolean;
  coverageRestricted: boolean;
  feeCents: number;
  minimumOrderCents: number;
  deliveryMinutes: number;
};
'''
    if marker not in source:
        raise RuntimeError("DeliveryQuote insertion marker not found")
    source = source.replace(marker, insert + marker, 1)

start = source.index("function Checkout(")
end = source.index("\nfunction OrderSuccess", start)

checkout = '''function Checkout({ menu, entries, total, clientOrderId, fulfillmentType, tableCode, close, done }: { menu: MenuData; entries: CartEntry[]; total: number; clientOrderId: string; fulfillmentType: FulfillmentType; tableCode: string; close: () => void; done: (result: OrderResult) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(menu.restaurant.pixAvailable ? "pix" : "card_on_delivery");
  const [postalCode, setPostalCode] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const subtotal = entries.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  useEffect(() => {
    if (fulfillmentType !== "delivery") {
      setDeliveryQuote(null);
      setQuoteError("");
      setQuoteBusy(false);
      return;
    }
    const normalizedPostalCode = postalCode.replace(/\\D/g, "");
    if (normalizedPostalCode.length !== 8 || neighborhood.trim().length < 2) {
      setDeliveryQuote(null);
      setQuoteError("");
      setQuoteBusy(false);
      return;
    }

    setDeliveryQuote(null);
    setQuoteError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteBusy(true);
      fetch("/api/public/delivery-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantSlug: menu.restaurant.slug,
          postalCode: normalizedPostalCode,
          neighborhood: neighborhood.trim(),
        }),
      })
        .then(async (response) => {
          const payload = await response.json() as {
            quote?: DeliveryQuote;
            error?: { code?: string; message?: string };
          };
          if (!response.ok || !payload.quote) {
            throw new Error(payload.error?.message || "Não foi possível confirmar a entrega para este endereço.");
          }
          return payload.quote;
        })
        .then((quote) => {
          setDeliveryQuote(quote);
          setQuoteError("");
        })
        .catch((reason) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setDeliveryQuote(null);
          setQuoteError(reason instanceof Error ? reason.message : "Não foi possível confirmar a entrega.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteBusy(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fulfillmentType, menu.restaurant.slug, neighborhood, postalCode]);

  const deliveryFeeCents = fulfillmentType === "delivery"
    ? (deliveryQuote?.feeCents ?? menu.restaurant.deliveryFeeCents)
    : 0;
  const minimumOrderCents = fulfillmentType === "delivery"
    ? (deliveryQuote?.minimumOrderCents ?? menu.restaurant.minimumOrderCents)
    : 0;
  const checkoutTotal = fulfillmentType === "delivery" ? subtotal + deliveryFeeCents : total;
  const deliveryReady = fulfillmentType !== "delivery" || Boolean(deliveryQuote && !quoteError);
  const minimumMet = fulfillmentType !== "delivery" || subtotal >= minimumOrderCents;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (fulfillmentType === "delivery" && !deliveryReady) {
      setError("Informe CEP e bairro e aguarde a confirmação da área de entrega.");
      return;
    }
    if (!minimumMet) {
      setError(`O pedido mínimo para esta região é ${currency.format(minimumOrderCents / 100)}.`);
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const address = fulfillmentType === "delivery" ? {
        street: form.get("street"),
        number: form.get("number"),
        neighborhood: form.get("neighborhood"),
        city: form.get("city"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        complement: form.get("complement") || null,
      } : null;
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: menu.restaurant.slug,
          clientOrderId,
          source: "menu",
          fulfillmentType,
          tableCode: fulfillmentType === "dine_in" ? tableCode : null,
          customer: {
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email") || null,
            whatsappConsent: form.get("consent") === "on",
            address,
          },
          items: entries.map((item) => ({ productId: item.id, quantity: item.quantity, optionIds: item.optionIds })),
          paymentMethod: payment,
        }),
      });
      const payload = await response.json() as OrderResult & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível enviar o pedido.");
      done(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(false);
    }
  };

  const modeTitle = fulfillmentType === "delivery" ? "Entrega" : fulfillmentType === "pickup" ? "Retirada no estabelecimento" : `Consumo no local · Mesa ${tableCode}`;
  const paymentMoment = fulfillmentType === "delivery" ? "Na entrega" : fulfillmentType === "pickup" ? "Na retirada" : "No atendimento";
  const submitDisabled = busy || quoteBusy || !deliveryReady || !minimumMet;
  const submitLabel = busy
    ? "Criando pedido seguro…"
    : quoteBusy
      ? "Confirmando área de entrega…"
      : !deliveryReady && fulfillmentType === "delivery"
        ? "Confirme CEP e bairro"
        : !minimumMet
          ? `Faltam ${currency.format((minimumOrderCents - subtotal) / 100)}`
          : `Confirmar · ${currency.format(checkoutTotal / 100)}`;

  return <div className="rm-modal-backdrop" onMouseDown={close}><div className="rm-checkout" onMouseDown={(event) => event.stopPropagation()}><header><div><small>ÚLTIMO PASSO · {modeTitle.toUpperCase()}</small><h2>Finalizar pedido</h2><p>Total de {currency.format(checkoutTotal / 100)}</p></div><button onClick={close}>✕</button></header><form onSubmit={submit}><fieldset><legend>Seus dados</legend><label>Nome<input name="name" required minLength={2} autoComplete="name" /></label><label>WhatsApp<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(24) 99999-9999" /></label><label className="wide">E-mail <small>{payment === "pix" ? "necessário para gerar o Pix" : "opcional"}</small><input name="email" required={payment === "pix"} type="email" autoComplete="email" /></label></fieldset>{fulfillmentType === "delivery" && <fieldset><legend>Endereço de entrega</legend><label className="wide">Rua<input name="street" required autoComplete="address-line1" /></label><label>Número<input name="number" required /></label><label>Complemento<input name="complement" autoComplete="address-line2" /></label><label>Bairro<input name="neighborhood" required value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} /></label><label>CEP<input name="postalCode" required inputMode="numeric" pattern="[0-9.\\- ]{8,10}" autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></label><label>Cidade<input name="city" required defaultValue={menu.restaurant.city} autoComplete="address-level2" /></label><label>UF<input name="state" required minLength={2} maxLength={2} defaultValue={menu.restaurant.state} autoComplete="address-level1" /></label><div className="wide" role="status" aria-live="polite" style={{ padding: 12, borderRadius: 12, background: quoteError ? "#fff1ef" : "#f5f7f2", border: `1px solid ${quoteError ? "#f3b8ae" : "#dfe4da"}`, lineHeight: 1.5 }}>{quoteBusy ? <><b>Confirmando sua região…</b><br/><small>Calculando taxa, pedido mínimo e previsão.</small></> : quoteError ? <><b>Entrega indisponível para este endereço</b><br/><small>{quoteError}</small></> : deliveryQuote ? <><b>{deliveryQuote.zoneName ? `Entrega confirmada · ${deliveryQuote.zoneName}` : "Entrega confirmada"}</b><br/><small>Taxa {currency.format(deliveryQuote.feeCents / 100)} · mínimo {deliveryQuote.minimumOrderCents ? currency.format(deliveryQuote.minimumOrderCents / 100) : "sem mínimo"} · previsão {deliveryQuote.deliveryMinutes}–{deliveryQuote.deliveryMinutes + 8} min</small></> : <><b>Confirme sua área de entrega</b><br/><small>Informe CEP e bairro para ver a taxa e o mínimo reais antes de pagar.</small></>}</div></fieldset>}{fulfillmentType !== "delivery" && <fieldset><legend>{modeTitle}</legend><p style={{ margin: 0, lineHeight: 1.5 }}>{fulfillmentType === "pickup" ? `Seu pedido será preparado para retirada em ${menu.restaurant.name}. Nenhuma taxa de entrega será cobrada.` : `Este pedido ficará vinculado à mesa ${tableCode}. Nenhum endereço de entrega é necessário.`}</p></fieldset>}<fieldset><legend>Pagamento</legend><div className="rm-payment-options">{menu.restaurant.pixAvailable && <label className={payment === "pix" ? "active" : ""}><input type="radio" name="payment" value="pix" checked={payment === "pix"} onChange={() => setPayment("pix")} /><span>▦</span><b>Pix</b><small>QR Code ou copia e cola</small></label>}<label className={payment === "cash" ? "active" : ""}><input type="radio" name="payment" value="cash" checked={payment === "cash"} onChange={() => setPayment("cash")} /><span>💵</span><b>Dinheiro</b><small>{paymentMoment}</small></label><label className={payment === "card_on_delivery" ? "active" : ""}><input type="radio" name="payment" value="card_on_delivery" checked={payment === "card_on_delivery"} onChange={() => setPayment("card_on_delivery")} /><span>▣</span><b>Cartão</b><small>{paymentMoment}</small></label></div></fieldset><label className="rm-consent"><input name="consent" type="checkbox" /><span>Quero receber novidades e lembretes de recompra pelo WhatsApp. Posso cancelar quando quiser.</span></label>{error && <p className="rm-checkout-error">{error}</p>}<button className="rm-submit-order" disabled={submitDisabled}>{submitLabel}</button></form></div></div>;
}
'''

source = source[:start] + checkout + source[end:]
path.write_text(source)
