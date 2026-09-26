# PRD 01: Movie lists

Terms (Tracked movie, Status, Watched date, Favourite) are defined in [CONTEXT.md](../../CONTEXT.md).

## Goal

Let me find a movie and log it as *To watch* or *Watched*, and mark the watched ones I loved as *Favourite*.

## Scope

- Single user, protected by login. Sign-up is closed.
- Runs locally. Deployment and hosting are out of scope.

## User stories

1. As a user, I want to search movies by title so I can find the one I'm thinking of.
2. As a user, I want to open a movie and see its poster, year and overview so I know it's the right one.
3. As a user, I want to add a movie to *To watch* so I remember to see it.
4. As a user, I want to mark a movie *Watched* so I keep a log of what I've seen, dated automatically.
5. As a user, I want to log a movie I saw long ago straight as *Watched* without adding it to *To watch* first.
6. As a user, I want to mark a watched movie as *Favourite* so I can find the ones I loved.
7. As a user, I want to undo a mistaken *Watched* by switching it off, which removes the movie.
8. As a user, I want to browse my *To watch*, *Watched* and *Favourites* lists.
9. As a user, I want to log in with my email and password so only I can see and change my lists.
10. As a user, I want to stay logged in on my phone so I rarely have to enter my password.
11. As a user, I want to log out, which ends the session on the server.

## Behaviour

### Movie page buttons

Each button switches its own state on and off.

| Current state | To watch | Watched | Favourite |
|---|---|---|---|
| Not tracked | → To watch | → Watched (date = today) | → Watched + Favourite |
| To watch | → removed | → Watched (date = today) | → Watched + Favourite |
| Watched | → To watch (date and Favourite cleared) | → removed (Favourite cleared) | turn Favourite on or off |

Invariants:
- A tracked movie has exactly one status: *To watch* or *Watched*.
- *Favourite* implies *Watched*.
- *Watched date* is set when a movie is marked *Watched* and cannot be edited.

### Screens

When not logged in, the app shows only a **Login** screen (email and password). There is no sign-up or password-reset screen.

Once logged in, the app shows bottom tabs: **Search · To watch · Watched · Favourites**. A logout button is available from the tabs.

| Screen | Content | Order |
|---|---|---|
| Search | Title search results from TMDB | TMDB relevance |
| To watch | Movies with status *To watch* | Most recently added first |
| Watched | Movies with status *Watched* | Watched date, newest first |
| Favourites | Watched movies marked *Favourite* | Watched date, newest first |

- **Row contents:** each row shows the poster, title and year. Tapping a row opens the movie page.
- **Empty screens:** each list shows one line of text pointing to Search.
- **Lists:** no sort or filter controls, and no pagination.

## Technical design

### Repo

A pnpm workspace with:
- `apps/mobile`: Expo + Expo Router, TypeScript. Runs through Expo Go.
- `apps/server`: Hono + Drizzle + SQLite, TypeScript.

The mobile app calls the server through Hono's typed RPC client (`hc`), so it needs no separate shared-types package.

### Server layers

- **Routes:** HTTP only. They parse input, call a service and return the response, with no business or data logic.
- **Services:** apply the button-table rules and the invariants above.
- **Repository:** Drizzle queries.
- **TMDB client:** the only code that talks to TMDB.

### Auth

- **Library:** Better Auth with email and password, stored in SQLite through its Drizzle adapter. It adds its own user, session and account tables.
- **Sessions:** sessions are stored in the database, and logging out deletes the session.
- **Mobile app:** the app uses Better Auth's Expo integration, which keeps the session in the phone's secure storage.
- **Sign-up:** disabled in the Better Auth config.
- **The one account:** created by a seed script from `SEED_EMAIL` and `SEED_PASSWORD` environment variables. Verify the script works while sign-up is disabled.
- **Protected routes:** every route except Better Auth's own endpoints requires a valid session, including search and movie details. A single middleware enforces this, not the individual routes.
- **Rate limiting:** Better Auth's built-in rate limiter on its endpoints.
- **Password changes:** none in the app. Re-run the seed script or change the password in the database directly.
- **Tracked movies:** no `user_id`. Only one account exists; add the column if a second user ever does.

### Data

- **Where TMDB calls happen:** only the server calls TMDB, and the API key is set in a server environment variable.
- **What's stored:** a tracked movie stores its TMDB id (unique) plus a copy of the title, year and poster path. List screens read only from the database, so they keep working when TMDB is down.
- **Refreshing:** the stored copy is never refreshed.
- **Movie page:** full details are fetched live from TMDB through the server each time and are not stored.

Suggested table `tracked_movies`:

| Column | Type | Notes |
|---|---|---|
| tmdb_id | integer | primary key |
| title | text | |
| year | integer | nullable |
| poster_path | text | nullable |
| status | text | `to_watch` \| `watched` |
| added_at | timestamp | when the movie started being tracked (or last moved to *To watch*) |
| watched_at | timestamp | set when status is `watched`, otherwise null |
| favourite | boolean | only true when status is `watched` |

"Removed" means the row is deleted.

### Configuration

- **Backend URL:** read by the mobile app from config.
- **Server environment variables:** the TMDB API key, Better Auth's secret, and `SEED_EMAIL`/`SEED_PASSWORD` for the seed script.

## Out of scope

- Watching status
- Ratings
- Rewatch history
- Sort or filter controls
- Explore discovery (Feature 2)
- Sign-up, password reset and multiple users
- Deployment and hosting
