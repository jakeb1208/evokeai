---
name: World status query payloads
description: Keep Supabase world-generation polling queries small even when saved Marble responses are large.
---

World-generation status checks should select only the ID, status, and error fields while a generation is pending. Fetch the full world record only after it is ready or when a user opens the saved world.

**Why:** `evoke_worlds.marble_world` stores the complete Marble response and can be large; selecting every column repeatedly from a status endpoint can cause Supabase statement timeouts (`57014`).

**How to apply:** Keep polling and list endpoints on narrow projections. Use a separate full-record query only when returning the completed world or its durable assets.
