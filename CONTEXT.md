# Watcher

Personal app for logging the movies I watch.

## Glossary

**Movie**
A film as described by The Movie Database (TMDB).

**Entry**
A movie I have added to my collection. Every entry has exactly one Status.
_Avoid:_ tracked movie, item

**Collection**
Every entry. To watch and Watched are the collection filtered by Status; Favourites is it filtered by Favourite.
_Avoid:_ tracking, library

**Drop**
Take a movie out of the collection. Its entry, with its Status, Watched date and Favourite, is lost.
_Avoid:_ untrack, remove, delete

**Status**
Either *To watch* or *Watched*, never both. Marking a movie *Watched* takes it off *To watch*. Unmarking *Watched* drops the movie; it does not fall back to *To watch*. Rewatches are not recorded.
_Avoid:_ Watching (no longer a Status)

**Watched date**
The day a movie was marked *Watched*. Set automatically, not editable. For films seen long ago, it is the day they were logged.

**Favourite**
A mark on a watched movie meaning I liked it. Only watched movies can be favourites, so unmarking *Watched* also clears the favourite. Favouriting an unwatched movie marks it *Watched* too. Not a status.
_Avoid:_ like, liked

**Favourites**
The screen showing every favourite. A view, not a list movies are added to.
