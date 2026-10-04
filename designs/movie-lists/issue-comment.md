## Approved mobile design

Canvas: https://claude.ai/artifact/QP9pXWrPVrT3HfWvSo8Ce7

Screens: Login, Search, Movie page (interactive in Play mode; its buttons follow the button table), To watch, Watched, Favourites (empty state), and a shared tab bar.

**Fonts** (bundle with `@expo-google-fonts/fraunces` + `@expo-google-fonts/instrument-sans`, loaded through `expo-font` before hiding the splash screen):
- Fraunces 600: app name, screen titles, movie titles
- Instrument Sans 400/500/600: everything else

**Palette** (dark only):

| Token | Hex | Use |
|---|---|---|
| background | `#16140F` | screens |
| surface | `#221F19` | inputs |
| border | `#3A352C` / `#4A443A` | input borders / unpressed buttons |
| text | `#F2EDE3` | primary text |
| muted | `#A39B8C` | year, labels, secondary text |
| accent | `#E8A33D` | active tab, pressed buttons, primary button, status line |

**Details:**
- Movie page: the three toggle buttons sit in a row at the bottom. On = amber fill with dark text, off = outlined. The status line under the year reads "Not in your lists", "On To watch" or "Watched on <date>".
- Logout: an icon button in the top-right of the list headers.
- Missing posters show a coloured placeholder block.
- The tab bar stays visible on the movie page.
