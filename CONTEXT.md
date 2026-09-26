# Watcher

Personal app for tracking the movies I watch.

## Glossary

**Movie**
A film as described by The Movie Database (TMDB).

**Tracked movie**
A movie I have added to my collection. Every tracked movie has exactly one Status. Untracking a movie takes it out of the collection entirely.

**Untrack**
Take a tracked movie out of the collection. Its Status, Watched date and Favourite are lost.
_Avoid:_ remove, delete

**Status**
Either *To watch* or *Watched*, never both. Marking a movie *Watched* takes it off *To watch*. Unmarking *Watched* untracks the movie; it does not fall back to *To watch*. Rewatches are not tracked.
_Avoid:_ Watching (dropped)

**Watched date**
The day a movie was marked *Watched*. Set automatically, not editable. For films seen long ago, it is the day they were logged.

**Favourite**
A mark on a watched movie meaning I liked it. Only watched movies can be favourites, so unmarking *Watched* also drops the favourite. Favouriting an unwatched movie marks it *Watched* too. Not a status.
_Avoid:_ like, liked

**Favourites**
The screen showing every favourite. A view, not a list movies are added to.
