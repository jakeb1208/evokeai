---
name: Quest 2 world viewing
description: Why the first Quest 2 client uses panoramas rather than runtime splats
---

For the Quest 2 native Unity client, start with owner-scoped saved-world panoramas and keep SPZ rendering as separate work requiring hardware validation. A device-model check is a compatibility gate for its native UI, not proof of device identity or an access-control boundary.

**Why:** World Labs' Unity guidance reports roughly 12 fps for 500k splats even on Quest 3 and problems with larger splats. Quest 2 has a smaller performance budget, while the existing world response already contains panorama assets and short-lived signed URLs. The user explicitly chose 360° viewing first.

**How to apply:** Do not promise walk-around SPZ worlds from the panorama client. If adding splats later, first prove dynamic loading and stereo performance on a physical Quest 2. Continue using the same Supabase accounts and owner-checked Railway world API; never put server-only keys in the headset build.