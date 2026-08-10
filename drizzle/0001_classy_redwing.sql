CREATE TABLE "brief_ticks" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brief_ticks" ADD CONSTRAINT "brief_ticks_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_ticks" ADD CONSTRAINT "brief_ticks_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brief_ticks_week_creator_unique" ON "brief_ticks" USING btree ("week_id","creator_id");