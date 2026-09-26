import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, check } from "drizzle-orm/sqlite-core";

// The toggle rules' invariants, enforced by the database too.
export const collectionEntry = sqliteTable(
  "collection_entry",
  {
    tmdbId: integer("tmdb_id").primaryKey(),
    title: text("title").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    status: text("status", { enum: ["to_watch", "watched"] }).notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
    watchedAt: integer("watched_at", { mode: "timestamp_ms" }),
    favourite: integer("favourite", { mode: "boolean" }).notNull(),
  },
  (t) => [
    check("status_valid", sql`${t.status} in ('to_watch', 'watched')`),
    check("watched_at_iff_watched", sql`(${t.status} = 'watched') = (${t.watchedAt} is not null)`),
    check("favourite_implies_watched", sql`not ${t.favourite} or ${t.status} = 'watched'`),
  ],
);
