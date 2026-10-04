CREATE TABLE "instagram_session" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"storage_state" jsonb NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_session_single_row" CHECK ("instagram_session"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "reel_scrape" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"reel" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reel_scrape_status_valid" CHECK ("reel_scrape"."status" in ('queued', 'running', 'done', 'failed'))
);
