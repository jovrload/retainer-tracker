DROP INDEX "brief_ticks_week_creator_unique";--> statement-breakpoint
ALTER TABLE "brief_ticks" ADD COLUMN "brief_no" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "brief_ticks_week_creator_brief_unique" ON "brief_ticks" USING btree ("week_id","creator_id","brief_no");