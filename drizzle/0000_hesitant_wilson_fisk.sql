CREATE TABLE "briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"brief_no" integer NOT NULL,
	"title" text NOT NULL,
	"brief_url" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"drive_folder_id" text NOT NULL,
	"reacher_handle" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"drive_file_id" text NOT NULL,
	"file_name" text,
	"size_bytes" integer,
	"mime_type" text,
	"created_time" timestamp with time zone,
	"is_late" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"creators_checked" integer DEFAULT 0 NOT NULL,
	"files_found" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_detail" text
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"iso_week" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	CONSTRAINT "weeks_iso_week_unique" UNIQUE("iso_week")
);
--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_drive_file_id_unique" ON "deliveries" USING btree ("drive_file_id");