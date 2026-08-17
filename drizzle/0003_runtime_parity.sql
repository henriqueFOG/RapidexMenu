-- Mantém o banco D1 usado pela prévia Sites compatível com o runtime principal.
-- Produção e HMG na Vercel continuam usando as migrations PostgreSQL versionadas.

CREATE TABLE `app_users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `full_name` text NOT NULL,
  `phone` text,
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active', 'blocked', 'deleted')),
  `auth_version` integer DEFAULT 1 NOT NULL,
  `last_login_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (lower(`email`));
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `trial_ends_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `onboarding_completed` integer DEFAULT 0 NOT NULL CHECK (`onboarding_completed` IN (0, 1));
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `published_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `terms_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `privacy_accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `access_ends_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `catalog_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `platform_blocked_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `platform_block_reason` text;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `platform_previous_status` text;
--> statement-breakpoint
UPDATE `restaurants`
SET `onboarding_completed` = 1,
    `published_at` = COALESCE(`published_at`, `created_at`),
    `trial_ends_at` = COALESCE(`trial_ends_at`, `created_at` + (14 * 24 * 60 * 60 * 1000))
WHERE `onboarding_completed` = 0;
--> statement-breakpoint
CREATE INDEX `restaurants_access_ends_at_idx` ON `restaurants` (`access_ends_at`);
--> statement-breakpoint
CREATE INDEX `restaurants_platform_blocked_idx` ON `restaurants` (`platform_blocked_at`) WHERE `platform_blocked_at` IS NOT NULL;
--> statement-breakpoint

CREATE TABLE `platform_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `provider` text DEFAULT 'mercado_pago' NOT NULL CHECK (`provider` = 'mercado_pago'),
  `provider_subscription_id` text,
  `plan` text NOT NULL CHECK (`plan` IN ('start', 'growth', 'scale')),
  `amount_cents` integer NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending', 'authorized', 'paused', 'cancelled', 'unknown')),
  `checkout_url` text,
  `next_payment_at` integer,
  `provider_data_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_subscriptions_provider_id_unique`
  ON `platform_subscriptions` (`provider`, `provider_subscription_id`)
  WHERE `provider_subscription_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `platform_subscriptions_restaurant_idx`
  ON `platform_subscriptions` (`restaurant_id`, `updated_at`);
--> statement-breakpoint

CREATE TABLE `password_reset_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `app_users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`, `expires_at`);
--> statement-breakpoint

CREATE TABLE `restaurant_payment_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL CHECK (`provider` = 'mercado_pago'),
  `provider_account_id` text,
  `access_token_ciphertext` text NOT NULL,
  `refresh_token_ciphertext` text,
  `token_expires_at` integer,
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active', 'expired', 'revoked', 'error')),
  `scopes` text,
  `connected_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  UNIQUE (`restaurant_id`, `provider`)
);
--> statement-breakpoint
CREATE INDEX `restaurant_payment_connections_provider_account_idx`
  ON `restaurant_payment_connections` (`provider`, `provider_account_id`);
--> statement-breakpoint

CREATE TABLE `growth_events` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `client_order_id` text NOT NULL,
  `order_id` text REFERENCES `orders`(`id`) ON DELETE SET NULL,
  `product_id` text REFERENCES `products`(`id`) ON DELETE SET NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('upsell_shown', 'upsell_accepted', 'reorder_suggested', 'reorder_converted')),
  `value_cents` integer DEFAULT 0 NOT NULL,
  `contribution_cents` integer DEFAULT 0 NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_events_unique_upsell`
  ON `growth_events` (`restaurant_id`, `client_order_id`, `event_type`, `product_id`);
--> statement-breakpoint
CREATE INDEX `growth_events_restaurant_created_idx` ON `growth_events` (`restaurant_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `growth_events_order_idx` ON `growth_events` (`order_id`);
--> statement-breakpoint

CREATE TABLE `whatsapp_order_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `customer_id` text NOT NULL REFERENCES `customers`(`id`) ON DELETE CASCADE,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  `client_order_id` text NOT NULL UNIQUE,
  `items_json` text DEFAULT '[]' NOT NULL,
  `address_json` text DEFAULT '{}' NOT NULL,
  `payment_method` text CHECK (`payment_method` IS NULL OR `payment_method` IN ('cash', 'card_on_delivery')),
  `stage` text DEFAULT 'collecting' NOT NULL CHECK (`stage` IN ('collecting', 'awaiting_address', 'awaiting_payment', 'awaiting_confirmation', 'completed')),
  `completed_order_id` text REFERENCES `orders`(`id`) ON DELETE SET NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE (`conversation_id`)
);
--> statement-breakpoint
CREATE INDEX `whatsapp_drafts_restaurant_updated_idx` ON `whatsapp_order_drafts` (`restaurant_id`, `updated_at`);
--> statement-breakpoint

CREATE TABLE `restaurant_whatsapp_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `waba_id` text NOT NULL,
  `business_id` text,
  `phone_number_id` text NOT NULL,
  `display_phone_number` text,
  `verified_name` text,
  `access_token_ciphertext` text NOT NULL,
  `two_factor_pin_ciphertext` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active', 'revoked', 'error')),
  `connected_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  UNIQUE (`restaurant_id`),
  UNIQUE (`phone_number_id`)
);
--> statement-breakpoint
CREATE INDEX `restaurant_whatsapp_connections_waba_idx` ON `restaurant_whatsapp_connections` (`waba_id`);
--> statement-breakpoint

CREATE TABLE `media_blobs` (
  `key` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `content_type` text NOT NULL,
  `data_base64` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_media_blobs_restaurant` ON `media_blobs` (`restaurant_id`, `created_at`);
--> statement-breakpoint

CREATE TABLE `legal_acceptances` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `app_users`(`id`) ON DELETE CASCADE,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `document_type` text NOT NULL CHECK (`document_type` IN ('terms', 'privacy')),
  `document_version` text NOT NULL,
  `source` text DEFAULT 'signup' NOT NULL,
  `accepted_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  UNIQUE (`user_id`, `restaurant_id`, `document_type`, `document_version`)
);
--> statement-breakpoint
CREATE INDEX `legal_acceptances_restaurant_idx` ON `legal_acceptances` (`restaurant_id`, `accepted_at` DESC);
--> statement-breakpoint
CREATE INDEX `legal_acceptances_user_idx` ON `legal_acceptances` (`user_id`, `accepted_at` DESC);
--> statement-breakpoint

ALTER TABLE `orders` ADD `fulfillment_type` text DEFAULT 'delivery' NOT NULL CHECK (`fulfillment_type` IN ('delivery', 'pickup', 'dine_in'));
--> statement-breakpoint
ALTER TABLE `orders` ADD `table_code` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `scheduled_for` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_zone_id` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_zone_name` text;
--> statement-breakpoint
CREATE INDEX `orders_restaurant_fulfillment_status_idx`
  ON `orders` (`restaurant_id`, `fulfillment_type`, `status`, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_schedule_idx`
  ON `orders` (`restaurant_id`, `scheduled_for`, `status`) WHERE `scheduled_for` IS NOT NULL;
--> statement-breakpoint

CREATE TABLE `product_option_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `product_id` text NOT NULL REFERENCES `products`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `min_select` integer DEFAULT 0 NOT NULL CHECK (`min_select` >= 0),
  `max_select` integer DEFAULT 1 NOT NULL CHECK (`max_select` >= 1 AND `max_select` <= 20),
  `pricing_strategy` text DEFAULT 'sum' NOT NULL CHECK (`pricing_strategy` IN ('sum', 'highest', 'average', 'included')),
  `position` integer DEFAULT 0 NOT NULL,
  `active` integer DEFAULT 1 NOT NULL CHECK (`active` IN (0, 1)),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CHECK (`min_select` <= `max_select`)
);
--> statement-breakpoint
CREATE INDEX `product_option_groups_product_idx` ON `product_option_groups` (`product_id`, `active`, `position`);
--> statement-breakpoint
CREATE INDEX `product_option_groups_restaurant_idx` ON `product_option_groups` (`restaurant_id`, `product_id`);
--> statement-breakpoint
CREATE TABLE `product_options` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `group_id` text NOT NULL REFERENCES `product_option_groups`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `price_delta_cents` integer DEFAULT 0 NOT NULL CHECK (`price_delta_cents` >= 0),
  `cost_delta_cents` integer DEFAULT 0 NOT NULL CHECK (`cost_delta_cents` >= 0),
  `available` integer DEFAULT 1 NOT NULL CHECK (`available` IN (0, 1)),
  `position` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_options_group_idx` ON `product_options` (`group_id`, `available`, `position`);
--> statement-breakpoint
CREATE INDEX `product_options_restaurant_idx` ON `product_options` (`restaurant_id`, `group_id`);
--> statement-breakpoint
CREATE TABLE `order_item_options` (
  `id` text PRIMARY KEY NOT NULL,
  `order_item_id` text NOT NULL REFERENCES `order_items`(`id`) ON DELETE CASCADE,
  `option_group_id` text,
  `option_id` text,
  `option_group_name` text NOT NULL,
  `option_name` text NOT NULL,
  `price_delta_cents` integer DEFAULT 0 NOT NULL,
  `cost_delta_cents` integer DEFAULT 0 NOT NULL,
  `pricing_strategy` text DEFAULT 'sum' NOT NULL CHECK (`pricing_strategy` IN ('sum', 'highest', 'average', 'included')),
  `charged_delta_cents` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_item_options_item_idx` ON `order_item_options` (`order_item_id`, `created_at`);
--> statement-breakpoint

CREATE TABLE `delivery_zones` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `match_type` text NOT NULL CHECK (`match_type` IN ('postal_prefix', 'neighborhood')),
  `match_value` text NOT NULL,
  `fee_cents` integer DEFAULT 0 NOT NULL CHECK (`fee_cents` >= 0),
  `minimum_order_cents` integer DEFAULT 0 NOT NULL CHECK (`minimum_order_cents` >= 0),
  `extra_minutes` integer DEFAULT 0 NOT NULL CHECK (`extra_minutes` >= 0 AND `extra_minutes` <= 240),
  `active` integer DEFAULT 1 NOT NULL CHECK (`active` IN (0, 1)),
  `position` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  UNIQUE (`restaurant_id`, `match_type`, `match_value`)
);
--> statement-breakpoint
CREATE INDEX `delivery_zones_restaurant_active_idx` ON `delivery_zones` (`restaurant_id`, `active`, `position`);
--> statement-breakpoint

ALTER TABLE `customers` ADD `marketing_opt_out_at` integer;
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `customer_id` text REFERENCES `customers`(`id`) ON DELETE SET NULL,
  `request_type` text NOT NULL CHECK (`request_type` IN ('access', 'correction', 'opt_out', 'deletion', 'portability')),
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending', 'in_review', 'completed', 'rejected')),
  `requester_reference` text,
  `details_json` text DEFAULT '{}' NOT NULL,
  `requested_at` integer NOT NULL,
  `completed_at` integer,
  `completed_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_restaurant_status_idx` ON `privacy_requests` (`restaurant_id`, `status`, `requested_at` DESC);
--> statement-breakpoint
CREATE INDEX `privacy_requests_customer_idx` ON `privacy_requests` (`customer_id`, `requested_at` DESC);
--> statement-breakpoint

CREATE TABLE `billing_dunning_events` (
  `id` text PRIMARY KEY NOT NULL,
  `subscription_id` text NOT NULL REFERENCES `platform_subscriptions`(`id`) ON DELETE CASCADE,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `stage` text NOT NULL CHECK (`stage` IN ('grace_started', 'grace_24h', 'suspended')),
  `cycle_key` text NOT NULL,
  `recipient_email` text NOT NULL,
  `status` text DEFAULT 'sending' NOT NULL CHECK (`status` IN ('sending', 'sent', 'failed')),
  `attempt_count` integer DEFAULT 1 NOT NULL,
  `last_error` text,
  `last_attempt_at` integer NOT NULL,
  `sent_at` integer,
  `created_at` integer NOT NULL,
  UNIQUE (`subscription_id`, `stage`, `cycle_key`)
);
--> statement-breakpoint
CREATE INDEX `billing_dunning_restaurant_created_idx` ON `billing_dunning_events` (`restaurant_id`, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `billing_dunning_status_attempt_idx` ON `billing_dunning_events` (`status`, `last_attempt_at`);
--> statement-breakpoint

CREATE TABLE `ai_usage_daily` (
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `usage_day` text NOT NULL,
  `response_requests` integer DEFAULT 0 NOT NULL,
  `transcription_requests` integer DEFAULT 0 NOT NULL,
  `input_tokens` integer DEFAULT 0 NOT NULL,
  `output_tokens` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`restaurant_id`, `usage_day`)
);
--> statement-breakpoint
CREATE INDEX `ai_usage_daily_day_idx` ON `ai_usage_daily` (`usage_day`, `updated_at` DESC);
--> statement-breakpoint
CREATE TABLE `ai_provider_circuits` (
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `failure_count` integer DEFAULT 0 NOT NULL,
  `window_started_at` integer NOT NULL,
  `open_until` integer,
  `last_error_code` text,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`restaurant_id`, `provider`)
);
--> statement-breakpoint
CREATE INDEX `ai_provider_circuits_open_idx` ON `ai_provider_circuits` (`provider`, `open_until`);
--> statement-breakpoint

CREATE TABLE `job_queue` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `job_type` text NOT NULL,
  `idempotency_key` text NOT NULL UNIQUE,
  `payload_json` text NOT NULL,
  `status` text DEFAULT 'queued' NOT NULL CHECK (`status` IN ('queued', 'running', 'retry', 'completed', 'dead')),
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `max_attempts` integer DEFAULT 5 NOT NULL CHECK (`max_attempts` BETWEEN 1 AND 20),
  `available_at` integer NOT NULL,
  `locked_at` integer,
  `locked_by` text,
  `last_error_code` text,
  `completed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_queue_claim_idx` ON `job_queue` (`status`, `available_at`, `created_at`);
--> statement-breakpoint
CREATE INDEX `job_queue_restaurant_created_idx` ON `job_queue` (`restaurant_id`, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `job_queue_dead_idx` ON `job_queue` (`job_type`, `updated_at` DESC) WHERE `status` = 'dead';
--> statement-breakpoint

CREATE TABLE `platform_subscription_events` (
  `id` text PRIMARY KEY NOT NULL,
  `subscription_id` text NOT NULL REFERENCES `platform_subscriptions`(`id`) ON DELETE CASCADE,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `source` text NOT NULL,
  `status_before` text,
  `status_after` text NOT NULL,
  `plan_before` text,
  `plan_after` text NOT NULL,
  `amount_before_cents` integer,
  `amount_after_cents` integer NOT NULL,
  `occurred_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_subscription_events_occurred_idx` ON `platform_subscription_events` (`occurred_at` DESC);
--> statement-breakpoint
CREATE INDEX `platform_subscription_events_restaurant_idx` ON `platform_subscription_events` (`restaurant_id`, `occurred_at` DESC);
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_subscription_events`
(`id`, `subscription_id`, `restaurant_id`, `source`, `status_before`, `status_after`,
 `plan_before`, `plan_after`, `amount_before_cents`, `amount_after_cents`, `occurred_at`, `created_at`)
SELECT 'snapshot-' || `id`, `id`, `restaurant_id`, 'migration_snapshot', NULL, `status`,
       NULL, `plan`, NULL, `amount_cents`, (unixepoch() * 1000), (unixepoch() * 1000)
FROM `platform_subscriptions`;
--> statement-breakpoint

CREATE TABLE `platform_admins` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `app_users`(`id`) ON DELETE CASCADE,
  `role` text DEFAULT 'support' NOT NULL CHECK (`role` IN ('owner', 'admin', 'support', 'viewer')),
  `status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active', 'blocked', 'revoked')),
  `created_by_user_id` text REFERENCES `app_users`(`id`) ON DELETE SET NULL,
  `last_access_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE (`user_id`)
);
--> statement-breakpoint
CREATE INDEX `platform_admins_status_role_idx` ON `platform_admins` (`status`, `role`);
--> statement-breakpoint
CREATE TABLE `platform_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_user_id` text REFERENCES `app_users`(`id`) ON DELETE SET NULL,
  `actor_email` text NOT NULL,
  `actor_role` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text,
  `reason` text,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `request_id` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_audit_logs_created_idx` ON `platform_audit_logs` (`created_at` DESC);
--> statement-breakpoint
CREATE INDEX `platform_audit_logs_target_idx` ON `platform_audit_logs` (`target_type`, `target_id`, `created_at` DESC);
--> statement-breakpoint
CREATE TABLE `platform_support_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `restaurant_id` text NOT NULL REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  `actor_user_id` text REFERENCES `app_users`(`id`) ON DELETE SET NULL,
  `actor_email` text NOT NULL,
  `note` text NOT NULL,
  `visibility` text DEFAULT 'internal' NOT NULL CHECK (`visibility` = 'internal'),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_support_notes_restaurant_idx` ON `platform_support_notes` (`restaurant_id`, `created_at` DESC);
--> statement-breakpoint
CREATE TABLE `platform_admin_mfa` (
  `admin_id` text PRIMARY KEY NOT NULL REFERENCES `platform_admins`(`id`) ON DELETE CASCADE,
  `secret_ciphertext` text NOT NULL,
  `enabled_at` integer,
  `last_verified_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

-- Revoga apenas o papel na Central; conta e vínculo com estabelecimento permanecem.
UPDATE `platform_admins`
SET `status` = 'revoked', `updated_at` = (unixepoch() * 1000)
WHERE `user_id` IN (SELECT `id` FROM `app_users` WHERE lower(`email`) = 'heloisa.gall@gmail.com')
  AND `status` <> 'revoked';
--> statement-breakpoint
UPDATE `app_users`
SET `auth_version` = `auth_version` + 1, `updated_at` = (unixepoch() * 1000)
WHERE lower(`email`) = 'heloisa.gall@gmail.com'
  AND EXISTS (SELECT 1 FROM `platform_admins` WHERE `platform_admins`.`user_id` = `app_users`.`id`);
--> statement-breakpoint

CREATE TABLE `maintenance_schedules` (
  `task` text PRIMARY KEY NOT NULL,
  `next_run_at` integer NOT NULL,
  `last_started_at` integer,
  `last_completed_at` integer,
  `status` text DEFAULT 'idle' NOT NULL CHECK (`status` IN ('idle', 'running', 'failed')),
  `detail` text
);
--> statement-breakpoint
INSERT OR IGNORE INTO `maintenance_schedules` (`task`, `next_run_at`, `status`)
VALUES ('orphan_media', 0, 'idle');
--> statement-breakpoint

-- Invariantes equivalentes aos gatilhos do PostgreSQL para a prévia D1.
CREATE TRIGGER `rapidex_order_item_stock_guard`
BEFORE INSERT ON `order_items`
WHEN NEW.`product_id` IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `products` p JOIN `orders` o ON o.`id` = NEW.`order_id`
    WHERE p.`id` = NEW.`product_id` AND p.`restaurant_id` = o.`restaurant_id`
  ) THEN RAISE(ABORT, 'rapidex_cross_tenant_order_item') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `products` p
    WHERE p.`id` = NEW.`product_id` AND p.`stock_control_enabled` = 1
      AND (p.`stock_quantity` IS NULL OR p.`stock_quantity` < NEW.`quantity`)
  ) THEN RAISE(ABORT, 'rapidex_insufficient_stock') END;
END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_scheduled_order_capacity_insert`
BEFORE INSERT ON `orders`
WHEN NEW.`scheduled_for` IS NOT NULL
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM `orders`
    WHERE `restaurant_id` = NEW.`restaurant_id`
      AND `scheduled_for` >= ((NEW.`scheduled_for` / 900000) * 900000)
      AND `scheduled_for` < ((NEW.`scheduled_for` / 900000) * 900000) + 900000
      AND `status` <> 'canceled'
  ) >= (SELECT max(1, `max_concurrent_orders`) FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
  THEN RAISE(ABORT, 'rapidex_schedule_capacity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_scheduled_order_capacity_update`
BEFORE UPDATE OF `scheduled_for` ON `orders`
WHEN NEW.`scheduled_for` IS NOT NULL
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM `orders`
    WHERE `restaurant_id` = NEW.`restaurant_id` AND `id` <> NEW.`id`
      AND `scheduled_for` >= ((NEW.`scheduled_for` / 900000) * 900000)
      AND `scheduled_for` < ((NEW.`scheduled_for` / 900000) * 900000) + 900000
      AND `status` <> 'canceled'
  ) >= (SELECT max(1, `max_concurrent_orders`) FROM `restaurants` WHERE `id` = NEW.`restaurant_id`)
  THEN RAISE(ABORT, 'rapidex_schedule_capacity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_restore_stock_on_cancel`
AFTER UPDATE OF `status` ON `orders`
WHEN NEW.`status` = 'canceled' AND OLD.`status` <> 'canceled'
BEGIN
  UPDATE `products`
  SET `stock_quantity` = `stock_quantity` + COALESCE((
        SELECT SUM(oi.`quantity`) FROM `order_items` oi
        WHERE oi.`order_id` = NEW.`id` AND oi.`product_id` = `products`.`id`
      ), 0),
      `updated_at` = NEW.`updated_at`
  WHERE `restaurant_id` = NEW.`restaurant_id`
    AND `stock_control_enabled` = 1
    AND `stock_quantity` IS NOT NULL
    AND EXISTS (SELECT 1 FROM `order_items` oi WHERE oi.`order_id` = NEW.`id` AND oi.`product_id` = `products`.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_products_catalog_version_insert` AFTER INSERT ON `products`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_products_catalog_version_update` AFTER UPDATE ON `products`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_products_catalog_version_delete` AFTER DELETE ON `products`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = OLD.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_categories_catalog_version_insert` AFTER INSERT ON `categories`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_categories_catalog_version_update` AFTER UPDATE ON `categories`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_categories_catalog_version_delete` AFTER DELETE ON `categories`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = OLD.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_option_groups_catalog_version_insert` AFTER INSERT ON `product_option_groups`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_option_groups_catalog_version_update` AFTER UPDATE ON `product_option_groups`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_option_groups_catalog_version_delete` AFTER DELETE ON `product_option_groups`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = OLD.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_options_catalog_version_insert` AFTER INSERT ON `product_options`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_options_catalog_version_update` AFTER UPDATE ON `product_options`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = NEW.`restaurant_id`; END;
--> statement-breakpoint
CREATE TRIGGER `rapidex_options_catalog_version_delete` AFTER DELETE ON `product_options`
BEGIN UPDATE `restaurants` SET `catalog_version` = `catalog_version` + 1 WHERE `id` = OLD.`restaurant_id`; END;
