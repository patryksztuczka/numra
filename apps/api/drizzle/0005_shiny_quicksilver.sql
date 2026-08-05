CREATE TABLE `recurring_series` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bank_account_id` text NOT NULL,
	`seed_transaction_id` text,
	`kind` text DEFAULT 'income' NOT NULL,
	`label` text NOT NULL,
	`counterparty_name` text,
	`expected_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`cadence` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
