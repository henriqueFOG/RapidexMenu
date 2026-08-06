CREATE TABLE `rate_limit_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expires_idx` ON `rate_limit_buckets` (`expires_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_token` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tracking_token_unique` ON `orders` (`tracking_token`);--> statement-breakpoint
ALTER TABLE `restaurants` ADD `next_order_number` integer DEFAULT 1280 NOT NULL;