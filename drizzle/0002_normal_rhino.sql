CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_account_id` text,
	`external_phone_id` text,
	`secret_ref` text,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`last_error` text,
	`connected_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_restaurant_provider_unique` ON `integrations` (`restaurant_id`,`provider`);--> statement-breakpoint
CREATE INDEX `integrations_phone_idx` ON `integrations` (`provider`,`external_phone_id`);