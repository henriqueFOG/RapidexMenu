export const DEMO_RESTAURANT_ID = "rest_serra_burger";
export const DEMO_RESTAURANT_SLUG = "serra-burger";
export const PENDING_OWNER_EMAIL = "pending-owner@rapidexmenu.local";

type DemoProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  emoji: string;
  tag: string;
  prep: number;
  position: number;
};

const products: DemoProduct[] = [
  {
    id: "prod_smash",
    categoryId: "cat_burgers",
    name: "Smash da Serra",
    description: "Pão brioche, carne 120g, queijo, cebola caramelizada e molho da casa.",
    price: 2990,
    cost: 1170,
    emoji: "🍔",
    tag: "Mais pedido",
    prep: 12,
    position: 1,
  },
  {
    id: "prod_duplo",
    categoryId: "cat_burgers",
    name: "Duplo Imperial",
    description: "Dois smashs, cheddar, bacon crocante, picles e maionese defumada.",
    price: 3890,
    cost: 1520,
    emoji: "🥓",
    tag: "Campeão de margem",
    prep: 15,
    position: 2,
  },
  {
    id: "prod_verde",
    categoryId: "cat_burgers",
    name: "Verde da Montanha",
    description: "Burger de grão-de-bico, queijo, rúcula, tomate e molho de ervas.",
    price: 3190,
    cost: 1230,
    emoji: "🥬",
    tag: "Vegetariano",
    prep: 13,
    position: 3,
  },
  {
    id: "prod_fritas",
    categoryId: "cat_sides",
    name: "Fritas da Casa",
    description: "Batatas crocantes, páprica, parmesão e molho especial.",
    price: 1690,
    cost: 480,
    emoji: "🍟",
    tag: "Vai bem junto",
    prep: 9,
    position: 1,
  },
  {
    id: "prod_shake",
    categoryId: "cat_drinks",
    name: "Shake de Paçoca",
    description: "Sorvete cremoso, paçoca e caramelo salgado.",
    price: 1990,
    cost: 590,
    emoji: "🥤",
    tag: "Novo",
    prep: 6,
    position: 1,
  },
  {
    id: "prod_combo",
    categoryId: "cat_burgers",
    name: "Combo Rapidex",
    description: "Smash da Serra, fritas e refrigerante com preço especial.",
    price: 4590,
    cost: 1750,
    emoji: "⚡",
    tag: "Economize R$ 8",
    prep: 14,
    position: 4,
  },
];

export async function ensureDemoData(db: D1Database) {
  const exists = await db
    .prepare("SELECT id FROM restaurants WHERE id = ? LIMIT 1")
    .bind(DEMO_RESTAURANT_ID)
    .first<{ id: string }>();
  if (exists) return;

  const timestamp = Date.now();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT OR IGNORE INTO restaurants
         (id, slug, name, owner_email, plan, status, phone, whatsapp, city, state,
          delivery_fee_cents, minimum_order_cents, average_prep_minutes, delivery_minutes,
          max_concurrent_orders, next_order_number, is_open, settings_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'growth', 'trial', ?, ?, ?, ?, 690, 2000, 18, 24, 12, 1286, 1, ?, ?, ?)`,
      )
      .bind(
        DEMO_RESTAURANT_ID,
        DEMO_RESTAURANT_SLUG,
        "Serra Burger",
        PENDING_OWNER_EMAIL,
        "2422440000",
        "5524999999999",
        "Petrópolis",
        "RJ",
        JSON.stringify({ brandColor: "#ff650b", cuisine: "Hamburgueria artesanal" }),
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      )
      .bind("cat_burgers", DEMO_RESTAURANT_ID, "Burgers e combos", 1, timestamp, timestamp),
    db
      .prepare(
        "INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      )
      .bind("cat_sides", DEMO_RESTAURANT_ID, "Acompanhamentos", 2, timestamp, timestamp),
    db
      .prepare(
        "INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      )
      .bind("cat_drinks", DEMO_RESTAURANT_ID, "Bebidas", 3, timestamp, timestamp),
  ];

  for (const product of products) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO products
           (id, restaurant_id, category_id, name, description, price_cents, cost_cents, emoji,
            tag, active, available, prep_minutes, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
        )
        .bind(
          product.id,
          DEMO_RESTAURANT_ID,
          product.categoryId,
          product.name,
          product.description,
          product.price,
          product.cost,
          product.emoji,
          product.tag,
          product.prep,
          product.position,
          timestamp,
          timestamp,
        ),
    );
  }

  const customers = [
    ["cust_joao", "João Martins", "5524988880001", 6, 34680],
    ["cust_ana", "Ana Lima", "5524988880002", 4, 28140],
    ["cust_carla", "Carla Mendes", "5524988880003", 3, 19820],
    ["cust_rafael", "Rafael Costa", "5524988880004", 2, 10390],
  ] as const;
  for (const customer of customers) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO customers
           (id, restaurant_id, name, phone, order_count, lifetime_value_cents, last_order_at,
            whatsapp_consent, consent_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .bind(
          customer[0],
          DEMO_RESTAURANT_ID,
          customer[1],
          customer[2],
          customer[3],
          customer[4],
          timestamp - 20 * 60_000,
          timestamp - 30 * 24 * 60 * 60_000,
          timestamp - 90 * 24 * 60 * 60_000,
          timestamp,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO customer_preferences (id, customer_id, kind, value, confidence, source, created_at, updated_at) VALUES (?, ?, 'ingredient', ?, 100, 'order', ?, ?)",
      )
      .bind("pref_joao_onion", "cust_joao", "Sem cebola", timestamp, timestamp),
    db
      .prepare(
        "INSERT OR IGNORE INTO customer_preferences (id, customer_id, kind, value, confidence, source, created_at, updated_at) VALUES (?, ?, 'delivery', ?, 100, 'order', ?, ?)",
      )
      .bind("pref_joao_home", "cust_joao", "Entrega em casa", timestamp, timestamp),
  );

  const demoOrders = [
    ["order_1285", "cust_carla", 1285, "received", "menu", 5680, 2060, 1],
    ["order_1284", "cust_joao", 1284, "preparing", "whatsapp", 6480, 2380, 12],
    ["order_1283", "cust_ana", 1283, "out_for_delivery", "menu", 8270, 2920, 20],
    ["order_1282", "cust_rafael", 1282, "received", "link", 3890, 1520, 4],
    ["order_1281", "cust_ana", 1281, "preparing", "link", 11240, 3860, 18],
    ["order_1280", "cust_joao", 1280, "delivered", "whatsapp", 5280, 1940, 95],
  ] as const;

  for (const order of demoOrders) {
    const createdAt = timestamp - order[7] * 60_000;
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO orders
           (id, restaurant_id, customer_id, order_number, client_order_id, tracking_token, source,
            status, payment_status, payment_method, subtotal_cents, delivery_fee_cents, total_cents,
            cost_cents, contribution_margin_cents, promised_from_minutes, promised_to_minutes,
            created_at, updated_at, delivered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'pix', ?, 690, ?, ?, ?, 42, 50, ?, ?, ?)`,
        )
        .bind(
          order[0],
          DEMO_RESTAURANT_ID,
          order[1],
          order[2],
          `demo-${order[2]}`,
          `track-demo-${order[2]}`,
          order[4],
          order[3],
          order[5] - 690,
          order[5],
          order[6],
          order[5] - order[6] - 690,
          createdAt,
          createdAt,
          order[3] === "delivered" ? createdAt + 50 * 60_000 : null,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("item_1285", "order_1285", "prod_combo", "Combo Rapidex", 1, 4590, 1750, timestamp),
    db
      .prepare(
        "INSERT OR IGNORE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("item_1284_a", "order_1284", "prod_smash", "Smash da Serra", 1, 2990, 1170, timestamp),
    db
      .prepare(
        "INSERT OR IGNORE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price_cents, unit_cost_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("item_1284_b", "order_1284", "prod_fritas", "Fritas da Casa", 1, 1690, 480, timestamp),
    db
      .prepare(
        `INSERT OR IGNORE INTO automation_events
         (id, restaurant_id, kind, status, reason, expected_revenue_cents, recovered_revenue_cents,
          margin_percent, metadata_json, created_at, updated_at)
         VALUES (?, ?, 'winback', 'draft', ?, 41200, 0, 39, ?, ?, ?)`,
      )
      .bind(
        "auto_winback_thursday",
        DEMO_RESTAURANT_ID,
        "26 clientes costumam pedir às quintas e ainda não voltaram.",
        JSON.stringify({ audience: 26, recommendedProductId: "prod_combo", bestTime: "now" }),
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO automation_events
         (id, restaurant_id, kind, status, reason, expected_revenue_cents, recovered_revenue_cents,
          margin_percent, metadata_json, created_at, updated_at)
         VALUES (?, ?, 'cart_recovery', 'converted', ?, 6840, 6840, 41, '{}', ?, ?)`,
      )
      .bind(
        "auto_cart_recovered",
        DEMO_RESTAURANT_ID,
        "Carrinho recuperado por contexto de conversa.",
        timestamp - 2 * 60 * 60_000,
        timestamp,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO subscriptions
         (id, restaurant_id, plan, status, trial_ends_at, created_at, updated_at)
         VALUES (?, ?, 'growth', 'trialing', ?, ?, ?)`,
      )
      .bind(
        "sub_serra",
        DEMO_RESTAURANT_ID,
        timestamp + 14 * 24 * 60 * 60_000,
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO integrations
         (id, restaurant_id, provider, status, settings_json, created_at, updated_at)
         VALUES (?, ?, 'whatsapp', 'pending', '{}', ?, ?)`,
      )
      .bind("integration_serra_whatsapp", DEMO_RESTAURANT_ID, timestamp, timestamp),
    db
      .prepare(
        `INSERT OR IGNORE INTO integrations
         (id, restaurant_id, provider, status, settings_json, created_at, updated_at)
         VALUES (?, ?, 'mercado_pago', 'pending', '{}', ?, ?)`,
      )
      .bind("integration_serra_mp", DEMO_RESTAURANT_ID, timestamp, timestamp),
    db
      .prepare(
        `INSERT OR IGNORE INTO integrations
         (id, restaurant_id, provider, status, settings_json, created_at, updated_at)
         VALUES (?, ?, 'openai', 'pending', '{}', ?, ?)`,
      )
      .bind("integration_serra_openai", DEMO_RESTAURANT_ID, timestamp, timestamp),
  );

  await db.batch(statements);
}
