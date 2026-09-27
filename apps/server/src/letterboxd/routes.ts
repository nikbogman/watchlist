import { Hono } from "hono";
import type { Auth } from "../auth/auth.js";
import type { Db } from "../db.js";
import type { Tmdb } from "../tmdb/tmdb.js";
import { importLetterboxd } from "./import.js";

/**
 * POST a multipart form: email, password, and the export's watched.csv, watchlist.csv and likes/films.csv
 * as watched, watchlist and likes.
 */
export function letterboxdRoutes(auth: Auth, db: Db, tmdb: Tmdb) {
  return new Hono().post("/", async (c) => {
    const { email, password, watched, watchlist, likes } =
      await c.req.parseBody();

    // Signs in through Better Auth's own endpoint, so wrong passwords are rate-limited like the app's login.
    const signIn = await auth.handler(
      new Request(new URL("/api/auth/sign-in/email", c.req.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": c.req.header("x-forwarded-for") ?? "",
        },
        body: JSON.stringify({ email, password }),
      }),
    );
    if (!signIn.ok)
      return c.json(
        { error: "Wrong email or password" },
        signIn.status === 429 ? 429 : 401,
      );

    if (
      !(
        watched instanceof File &&
        watchlist instanceof File &&
        likes instanceof File
      )
    ) {
      return c.json(
        { error: "Upload watched, watchlist and likes as CSV files" },
        400,
      );
    }
    const csv = {
      watched: await watched.text(),
      watchlist: await watchlist.text(),
      likes: await likes.text(),
    };
    return c.json(await importLetterboxd(db, tmdb, csv));
  });
}
