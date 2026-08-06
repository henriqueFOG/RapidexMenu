CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_restaurant_created_idx` ON `audit_logs` (`restaurant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `automation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` text,
	`order_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reason` text,
	`expected_revenue_cents` integer DEFAULT 0 NOT NULL,
	`recovered_revenue_cents` integer DEFAULT 0 NOT NULL,
	`margin_percent` integer,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `automation_restaurant_status_idx` ON `automation_events` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_restaurant_position_idx` ON `categories` (`restaurant_id`,`position`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` text,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`external_contact_id` text NOT NULL,
	`status` text DEFAULT 'bot' NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_contact_unique` ON `conversations` (`restaurant_id`,`channel`,`external_contact_id`);--> statement-breakpoint
CREATE TABLE `customer_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`confidence` integer DEFAULT 100 NOT NULL,
	`source` text DEFAULT 'order' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_preferences_unique` ON `customer_preferences` (`customer_id`,`kind`,`value`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`default_address_json` text,
	`order_count` integer DEFAULT 0 NOT NULL,
	`lifetime_value_cents` integer DEFAULT 0 NOT NULL,
	`last_order_at` integer,
	`whatsapp_consent` integer DEFAULT false NOT NULL,
	`consent_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_restaurant_phone_unique` ON `customers` (`restaurant_id`,`phone`);--> statement-breakpoint
CREATE INDEX `customers_restaurant_last_order_idx` ON `customers` (`restaurant_id`,`last_order_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`restaurant_name` text NOT NULL,
	`whatsapp` text NOT NULL,
	`monthly_orders_range` text,
	`source` text DEFAULT 'landing' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leads_status_created_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'operator' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_restaurant_email_unique` ON `members` (`restaurant_id`,`email`);--> statement-breakpoint
CREATE INDEX `members_email_idx` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`provider_message_id` text,
	`direction` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`body` text,
	`status` text DEFAULT 'received' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_provider_id_unique` ON `messages` (`provider_message_id`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`customer_id` text,
	`order_number` integer NOT NULL,
	`client_order_id` text NOT NULL,
	`source` text DEFAULT 'menu' NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text DEFAULT 'pix' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`contribution_margin_cents` integer DEFAULT 0 NOT NULL,
	`address_json` text,
	`notes` text,
	`promised_from_minutes` integer,
	`promised_to_minutes` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`confirmed_at` integer,
	`delivered_at` integer,
	`canceled_at` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_restaurant_number_unique` ON `orders` (`restaurant_id`,`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_restaurant_client_id_unique` ON `orders` (`restaurant_id`,`client_order_id`);--> statement-breakpoint
CREATE INDEX `orders_restaurant_status_created_idx` ON `orders` (`restaurant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_created_idx` ON `orders` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`provider` text DEFAULT 'mercado_pago' NOT NULL,
	`provider_payment_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_cents` integer NOT NULL,
	`pix_code` text,
	`ticket_url` text,
	`expires_at` integer,
	`provider_data_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_idempotency_unique` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_id_unique` ON `payments` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`emoji` text DEFAULT '🍽️' NOT NULL,
	`tag` text,
	`image_key` text,
	`active` integer DEFAULT true NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`stock_control_enabled` integer DEFAULT false NOT NULL,
	`stock_quantity` integer,
	`minimum_stock` integer,
	`prep_minutes` integer DEFAULT 10 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `products_restaurant_active_idx` ON `products` (`restaurant_id`,`active`,`available`);--> statement-breakpoint
CREATE INDEX `products_category_position_idx` ON `products` (`category_id`,`position`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`owner_email` text NOT NULL,
	`plan` text DEFAULT 'growth' NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`phone` text,
	`whatsapp` text,
	`city` text,
	`state` text,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`delivery_fee_cents` integer DEFAULT 690 NOT NULL,
	`minimum_order_cents` integer DEFAULT 2000 NOT NULL,
	`average_prep_minutes` integer DEFAULT 18 NOT NULL,
	`delivery_minutes` integer DEFAULT 24 NOT NULL,
	`max_concurrent_orders` integer DEFAULT 12 NOT NULL,
	`is_open` integer DEFAULT true NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_unique` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE INDEX `restaurants_owner_email_idx` ON `restaurants` (`owner_email`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`provider` text,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`trial_ends_at` integer,
	`current_period_ends_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_restaurant_unique` ON `subscriptions` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`signature_valid` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`payload_hash` text NOT NULL,
	`error` text,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_provider_event_unique` ON `webhook_events` (`provider`,`provider_event_id`);