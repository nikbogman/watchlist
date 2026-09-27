import type { Db } from "../db.js";
import { collectionEntry } from "../schema/index.js";
import type { Tmdb } from "../tmdb/tmdb.js";

/** Rows of a Letterboxd export CSV, keyed by header. Handles quoted fields ("Crouching Tiger, Hidden Dragon"). */
export function parseCsv(text: string) {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean).map(parseLine);
  return lines.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])),
  );
}

function parseLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted && c === '"' && line[i + 1] === '"') cell += line[i++];
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) (cells.push(cell), (cell = ""));
    else cell += c;
  }
  return [...cells, cell];
}

type Row = Record<string, string>;
type Movie = {
  name: string;
  year: number | null;
  status: "to_watch" | "watched";
  favourite: boolean;
  addedAt: Date;
  watchedAt: Date | null;
};

/** One Entry per movie, keyed by Letterboxd URI. Watched wins over the watchlist; a liked movie counts as Watched. */
export function moviesFrom({
  watched,
  watchlist,
  likes,
}: {
  watched: Row[];
  watchlist: Row[];
  likes: Row[];
}) {
  const movies = new Map<string, Movie>();
  const movie = (r: Row) => ({
    name: r.Name,
    year: r.Year ? Number(r.Year) : null,
    date: new Date(r.Date),
  });

  for (const r of watchlist) {
    const { name, year, date } = movie(r);
    movies.set(r["Letterboxd URI"], {
      name,
      year,
      status: "to_watch",
      favourite: false,
      addedAt: date,
      watchedAt: null,
    });
  }
  for (const r of [...watched, ...likes]) {
    const { name, year, date } = movie(r);
    const current = movies.get(r["Letterboxd URI"]);
    const watchedAt = current?.watchedAt ?? date;
    movies.set(r["Letterboxd URI"], {
      name,
      year,
      status: "watched",
      favourite: current?.favourite ?? false,
      addedAt: current?.addedAt ?? date,
      watchedAt,
    });
  }
  for (const r of likes) movies.get(r["Letterboxd URI"])!.favourite = true;

  return [...movies.values()];
}

/** The three CSVs of a Letterboxd export: watched.csv, watchlist.csv and likes/films.csv. */
export type Export = { watched: string; watchlist: string; likes: string };

/** Adds the export's movies to the Collection. Movies already in it are left alone, so it is safe to rerun. */
export async function importLetterboxd(db: Db, tmdb: Tmdb, csv: Export) {
  const movies = moviesFrom({
    watched: parseCsv(csv.watched),
    watchlist: parseCsv(csv.watchlist),
    likes: parseCsv(csv.likes),
  });

  const notFound: string[] = [];
  let added = 0;
  for (const { name, year, ...entry } of movies) {
    // ponytail: exact title + year match on TMDB's first page, else skipped and reported
    const movie = (await tmdb.search(name)).find((m) => m.year === year);
    if (!movie) {
      notFound.push(`${name} (${year})`);
      continue;
    }
    const inserted = await db
      .insert(collectionEntry)
      .values({
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        posterPath: movie.posterPath,
        ...entry,
      })
      .onConflictDoNothing()
      .returning();
    added += inserted.length;
  }
  return { movies: movies.length, added, notFound };
}
