ALTER TABLE "deliveries" ADD COLUMN "is_tof" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "folder_path" text;