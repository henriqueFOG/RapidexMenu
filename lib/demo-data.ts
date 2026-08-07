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
  { id: "prod_smash", categoryId: "cat_burgers", name: "Smash da Serra", description: "Pão brioche, carne 120g, queijo, cebola caramelizada e molho da casa.", price: 2990, cost: 1170, emoji: "🍔", tag: "Mais pedido", prep: 12, position: 1 },
  { id: "prod_duplo", categoryId: "cat_burgers", name: "Duplo Imperial", description: "Dois smashs, cheddar, bacon crocante, picles e maionese defumada.", price: 3890, cost: 1520, emoji: "🥓", tag: "Campeão de margem", prep: 15, position: 2 },
  { id: "prod_verde", categoryId: "cat_burgers", name: "Verde da Montanha", description: "Burger de grão-de-bico, queijo, rúcula, tomate e molho de ervas.", price: 3190, cost: 1230, emoji: "🥬", tag: "Vegetariano", prep: 13, position: 3 },
  { id: "prod_fritas", categoryId: "cat_sides", name: "Fritas da Casa", description: "Batatas crocantes, páprica, parmesão e molho especial.", price: 1690, cost: 480, emoji: "🍟", tag: "Vai bem junto", prep: 9, position: 1 },
  { id: "prod_shake", categoryId: "cat_drinks", name: "Shake de Paçoca", description: "Sorvete cremoso, paçoca e caramelo salgado.", price: 1990, cost: 590, emoji: "🥤", tag: "Novo", prep: 6, position: 1 },
  { id: "prod_combo", categoryId: "cat_burgers", name: "Combo Rapidex", description: "Smash da Serra, fritas e refrigerante com preço especial.", price: 4590, cost: 1750, emoji: "⚡", tag: "Economize R$ 8", prep: 14, position: 4 },
];

export async function ensureDemoData(db: D1Database) {
  const exists = await db.prepare("SELECT id FROM restaurants WHERE id = ? LIMIT 1").bind(DEMO_RESTAURANT_ID).first<{ id: string }>();
  if (exists) return;

  const timestamp = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT OR IGNORE INTO restaurants
       (id, slug, name, owner_email, plan, status, phone, whatsapp, city, state,
        delivery_fee_cents, minimum_order_cents, average_prep_minutes, delivery_minutes,
        max_concurrent_orders, next_order_number, is_open, settings_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'growth', 'trial', ?, ?, ?, ?, 690, 2000, 18, 24, 12, 1286, 1, ?, ?, ?)`,
    ).bind(
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
    db.prepare("INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").bind("cat_burgers", DEMO_RESTAURANT_ID, "Burgers e combos", 1, timestamp, timestamp),
    db.prepare("INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").bind("cat_sides", DEMO_RESTAURANT_ID, "Acompanhamentos", 2, timestamp, timestamp),
    db.prepare("INSERT OR IGNORE INTO categories (id, restaurant_id, name, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").bind("cat_drinks", DEMO_RESTAURANT_ID, "Bebidas", 3, timestamp, timestamp),
  ];

  for (const product of products) {
    statements.push(
      db.prepare(
        `INSERT OR IGNORE INTO products
         (id, restaurant_id, category_id, name, description, price_cents, cost_cents, emoji,
          tag, active, available, prep_minutes, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
      ).bind(product.id, DEMO_RESTAURANT_ID, product.categoryId, product.name, product.description, product.price, product.cost, product.emoji, product.tag, product.prep, product.position, timestamp, timestamp),
    );
  }

  await db.batch(statements);
}
