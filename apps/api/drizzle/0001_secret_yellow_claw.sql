CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'enable_banking' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`aspsp_name` text NOT NULL,
	`aspsp_country` text NOT NULL,
	`auth_state` text,
	`session_id_encrypted` text,
	`valid_until` integer,
	`last_synced_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_auth_state_uidx` ON `connections` (`auth_state`);--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`identification_hash` text NOT NULL,
	`name` text,
	`currency` text NOT NULL,
	`iban` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_accounts_user_identification_hash_uidx` ON `bank_accounts` (`user_id`,`identification_hash`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank_account_id` text NOT NULL,
	`source_external_id` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`credit_debit` text NOT NULL,
	`description` text,
	`counterparty_name` text,
	`raw_payload` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_account_source_uidx` ON `transactions` (`bank_account_id`,`source_external_id`);
