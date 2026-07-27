ALTER TABLE `bank_accounts` ADD `balance_minor` integer;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `balance_currency` text;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `balance_type` text;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `balance_as_of` text;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `balance_synced_at` integer;