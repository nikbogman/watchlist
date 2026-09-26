CREATE TABLE `tracked_movies` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`poster_path` text,
	`status` text NOT NULL,
	`added_at` integer NOT NULL,
	`watched_at` integer,
	`favourite` integer NOT NULL,
	CONSTRAINT "status_valid" CHECK("tracked_movies"."status" in ('to_watch', 'watched')),
	CONSTRAINT "watched_at_iff_watched" CHECK(("tracked_movies"."status" = 'watched') = ("tracked_movies"."watched_at" is not null)),
	CONSTRAINT "favourite_implies_watched" CHECK(not "tracked_movies"."favourite" or "tracked_movies"."status" = 'watched')
);
