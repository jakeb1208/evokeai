# Explore: map-to-Street-View setup

Evoke's Explore page uses OpenStreetMap tiles for its clickable map and Google's **Maps Embed API** for interactive Street View. Clicking a map location opens the nearest available Street View panorama inside Evoke. It does not call Marble or generate an AI world. Some locations have no Street View coverage; try a nearby road if Google shows no panorama.

## Google Maps Embed API key

1. In a Google Cloud project, enable **Maps Embed API** and attach a billing account. [Google currently lists Embed API usage as free with unlimited requests](https://developers.google.com/maps/documentation/embed/usage-and-billing), but requires an API key. Other Google Maps products are billed separately; Explore does not use them.
2. Create a browser API key and restrict it to **Maps Embed API**. Add **HTTP referrer** restrictions for your Evoke production domain and, if you use the Replit preview, its preview domain.
3. Add the key as `VITE_GOOGLE_MAPS_EMBED_KEY` to the environment that builds the Evoke web app (Replit Secret for its preview; Railway build variable for the hosted app). Rebuild after adding or rotating it.

This is a browser-side key, so it is visible in the embedded URL. API and referrer restrictions are essential; do not reuse an unrestricted server key or a Supabase service-role key. The Google iframe uses `strict-origin-when-cross-origin` so the domain is available for referrer restrictions without passing Evoke's page path.

The map requests only tiles the visitor views and displays OpenStreetMap attribution. The community tile service has a [fair-use policy](https://operations.osmfoundation.org/policies/tiles/); if Evoke grows beyond light interactive usage, move the map layer to a hosted tile provider rather than bulk-fetching or preloading tiles.