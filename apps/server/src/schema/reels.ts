import { sql } from "drizzle-orm";
import { pgTable, text, integer, jsonb, timestamp, uuid, check } from "drizzle-orm/pg-core";
import type { Reel } from "../reels/queue.js";

// The reel scrape queue: each row is a job and, once done, its result.
export const reelScrape = pgTable(
  "reel_scrape",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    status: text("status", { enum: ["queued", "running", "done", "failed"] }).notNull().default("queued"),
    reel: jsonb("reel").$type<Reel>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("reel_scrape_status_valid", sql`${t.status} in ('queued', 'running', 'done', 'failed')`)],
);

// The one logged-in Instagram session the scraper browses with, as Playwright storage state.
export const instagramSession = pgTable(
  "instagram_session",
  {
    id: integer("id").primaryKey().default(1),
    storageState: jsonb("storage_state").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("instagram_session_single_row", sql`${t.id} = 1`)],
);
