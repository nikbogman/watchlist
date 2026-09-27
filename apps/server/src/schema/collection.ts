import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, check } from "drizzle-orm/pg-core";

// The Status and Favourite rules' invariants, enforced by the database too.
export const collectionEntry = pgTable(
  "collection_entry",
  {
    tmdbId: integer("tmdb_id").primaryKey(),
    title: text("title").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    status: text("status", { enum: ["to_watch", "watched"] }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull(),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
    favourite: boolean("favourite").notNull(),
  },
  (t) => [
    check("status_valid", sql`${t.status} in ('to_watch', 'watched')`),
    check("watched_at_iff_watched", sql`(${t.status} = 'watched') = (${t.watchedAt} is not null)`),
    check("favourite_implies_watched", sql`not ${t.favourite} or ${t.status} = 'watched'`),
  ],
);
