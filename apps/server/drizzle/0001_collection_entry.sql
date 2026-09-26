CREATE TABLE `collection_entry` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`poster_path` text,
	`status` text NOT NULL,
	`added_at` integer NOT NULL,
	`watched_at` integer,
	`favourite` integer NOT NULL,
	CONSTRAINT "status_valid" CHECK("collection_entry"."status" in ('to_watch', 'watched')),
	CONSTRAINT "watched_at_iff_watched" CHECK(("collection_entry"."status" = 'watched') = ("collection_entry"."watched_at" is not null)),
	CONSTRAINT "favourite_implies_watched" CHECK(not "collection_entry"."favourite" or "collection_entry"."status" = 'watched')
);
