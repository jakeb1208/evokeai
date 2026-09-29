---
name: Private music playback
description: Why personal music uses Supabase and how to keep continuous shuffled playback reliable
---

Keep personal music metadata and private audio storage with Evoke's existing Supabase account boundary rather than moving just the audio to another storage provider.

**Why:** The browser and eventual Quest client need to see the same owner-scoped library as saved worlds. A separate storage system would split access control and lifecycle management across providers.

**How to apply:** Server-side uploads and signed playback links must check the authenticated owner; never expose a public bucket or a server credential to the browser. Signed URLs are short-lived bearer links, so do not treat them as permanent public media URLs.

For continuous shuffled playback, treat the played songs, remaining songs, and failed songs as distinct state within a cycle. Do not reset failure tracking merely because a corrupt song briefly starts. Invalidate stale library loads after successful uploads.

**Why:** Otherwise a failing track can cause an endless skip loop, and a delayed list response can hide a newly uploaded song or remove it from the remaining queue.

**How to apply:** On a successful song completion or explicit retry, reset failure handling as appropriate; on library mutations or account changes, reconcile or discard older asynchronous results before updating the queue.