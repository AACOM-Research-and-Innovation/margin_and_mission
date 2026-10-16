# Margin and Mission — demo package

A three-year strategic budgeting simulation for the AACOM SLDP.
This folder contains everything needed to play it or to host it.

- `index.html` — the app (one file: all screens, logic, and styling)
- `server.js` — a small self-contained server that hosts the app and stores each session's shared state
- `README.md` — this file

The app has three roles that run at the same time and stay in sync:
**facilitator** (runs the rounds), **table CFO** (enters each table's decisions),
and **projection** (read-only standings for the room or a Zoom screen-share).

---
## A. Netlify deployment

The original 25-card version is hosted at https://marginandmission.netlify.app/.
This source provides a 16-card, nine-event verification revision for the
`margin-and-mission-trial` Netlify project in the AACOM Innovation team.
The planned test address is https://margin-and-mission-trial.netlify.app/;
it becomes usable after the first successful deployment from `trial-core-revision`.

Upon visiting the site, a user can select to be:
- **table CFO**: Makes budget decisions in the simulation.
- **facilitator**: Controls the rounds. Only one person should be the facilitator.
- **projection**: Displays the score of all team.

### Walkthrough and mentor notes

Use the facilitator's **Reset session** before deploying the renumbered catalog,
then refresh every device and start a fresh session for the walkthrough.
Saved sessions from earlier versions may contain removed cards or use the old
card numbering, which can identify different investments in the new catalog.

The institution starts with $47.04M net tuition revenue (640 students × $73,500)
and $3.96M other revenue. Total operating revenue remains $51.0M against $48.5M
expense, leaving a $2.5M starting margin. The restricted rural and community-health
gift is $1.5M; the one-time Investment Fund remains $5M.

The default catalog has 16 cards, numbered consecutively in display order.
The three restored cards and three restored events are flagged with `review: true`
and `REVIEW` comments in `index.html` for verification.

| Card | Investment | Dependency / review status |
| --- | --- | --- |
| 1 | Deferred maintenance | — |
| 2 | Business continuity | — |
| 3 | Cybersecurity uplift | — |
| 4 | Cyber liability insurance | Pays only alongside card 3 |
| 5 | Clinical AI and Health Informatics dual pathway | Card 12; otherwise 60% revenue |
| 6 | Biomedical Sciences bridge | **Review:** restored; revenue ×0.85 below 95% enrollment |
| 7 | Faculty development and retention pool | **Review:** restored; partial OMM mitigation |
| 8 | OMM depth and chair succession | Full OMM mitigation |
| 9 | Branch campus development | Revenue matures beyond the three-year exercise |
| 10 | Preceptor stipend program | Hospital and focused-visit mitigation; Year 1 Board Ask |
| 11 | Rural and underserved training track | Restricted-gift eligible; state-support mitigation |
| 12 | AI governance and faculty upskilling | — |
| 13 | Data infrastructure and institutional research | Extra private signal |
| 14 | Unified learning-platform migration | **Review:** restored; Year 2 Board Ask remains removed |
| 15 | Advancement officer | Full estate-gift capture with card 11 |
| 16 | Scholarship and tuition discount pool | Borrowing-cap mitigation |

The AI dual pathway costs $2.2M annually; OMM succession costs $350K annually.
The bridge uses the post-CFO $1.15M annual delivery cost, not its earlier $900K cost.
The other twelve larger-catalog options remain excluded.

| Year | Events | Restored event for review |
| --- | --- | --- |
| 1 | Borrowing caps; ransomware | Hospital acquisition / lost rotation slots |
| 2 | Storm; OMM chair departure | State support tied to primary-care placement |
| 3 | AI scrutiny; estate gift | Focused placement accreditation visit |

Event flow: signals brief → lock investments → Year 1 Board Ask if applicable →
reveal events → resolve outcomes → open the next year. Events occur within each
round, after choices lock; these are restored scenarios, not newly invented ones.

### Review dependencies and removal switches

`REVIEW_CONTENT` near the top of the catalog independently enables the restored
cards and restored events. Both are `true` for this revision. Set `cards: false`
to exclude cards 6, 7, and 14 and the retention-pool OMM tier. Set `events: false`
to exclude the three restored events. Set both to `false` for the core 13-card,
six-event version. Card IDs stay stable when filtering; only the enabled default
16-card catalog is consecutive. Start a fresh session after changing either switch.

| Restored item | Connection available now | Unavailable connection / review decision |
| --- | --- | --- |
| Biomedical bridge | Enrollment index drives the restored revenue multiplier | No missing prerequisite |
| Faculty retention pool | Restores OMM partial outcome: −$700K, −3 mission, no citation | No missing prerequisite; succession still provides full protection |
| Platform migration | Cost, recurring savings, and strategic points | Its original Year 2 Board Ask is still removed. Existing engine applies the −$180K tail on purchase despite the description's two-year lag; timing needs review |
| Hospital acquisition | Preceptor card 10 halves the loss to $400K and −3 mission | Clinical/GME partnership full mitigation is unavailable. The class-expansion penalty is omitted because class expansion is also absent |
| State-support formula | Rural track card 11 gives $1.5M support; otherwise −$500K | No missing mitigation |
| Focused placement visit | Preceptor card 10 closes the visit without findings | Competency curriculum and clinical/GME partnership alternative mitigations are unavailable |

Missing alternatives are documented rather than left as numeric references to
unrelated cards. Adding those investments would be a separate catalog decision.
The baseline and scoring formula are unchanged. With all review content enabled,
the reference prepared portfolio scores 55.8 and doing nothing scores 5.4.
With review events disabled, those portfolios score 70.2 and 24.6 respectively.
These different results are part of the verification, not a recalibration.

Read the preceptor **Board Ask in Year 1 only**, after decisions lock and before
events are revealed. Use the existing mentor rulings and facilitator controls;
Years 2–3 have no mid-year Board Ask. The Year 2 OMM event has three outcomes
while the retention pool is enabled: succession held (+1 mission, +1 strategic),
retention pool only (−$700K, −3 mission), or neither (−$1.4M, −7 mission, +1 citation).

For the mentor-led debrief, ask:

> Which of your choices would have needed buy-in you did not have to model here
> — from faculty, the board, or senior leadership — and how would you have secured it?

This question adds discussion, with no new scoring mechanic.

Run `npm test` to check the financial baseline, event outcomes, revenue
dependencies, and three-round CFO, facilitator, and projection rendering.
These checks use isolated local state and do not contact the live site.

### Build and deploy the trial

Use `npm run build` to run the checks and create `dist/index.html`.
Netlify reads the build command, publish directory (`dist`), and `/kv/*`
rewrite from `netlify.toml`. The `netlify/functions/kv.mjs` function supplies
shared state through the existing Netlify Blobs store; dropping only the HTML
onto Netlify will not provide cross-device sessions.

Connect a separate Netlify project to the test branch for continuous deployment,
or use an authenticated Netlify CLI deployment with the functions included.
`.netlify/` is ignored by Git so the local site-link file stays out of commits.
The new site's stored sessions are separate from the original site's sessions.

## B. Play with it right now (one computer, no install)

You can click through the whole thing on a single machine.

1. Double-click `index.html` (use Chrome or Edge).
2. It opens in **Local demo** mode — the bottom of the first screen says
   *"Server: Local demo — this browser only."* That's expected.
3. Open the **same file in a second and third browser tab**. In one tab pick
   **facilitator** and start a session; in another pick **table CFO**; in a third
   pick **projection**. The tabs share data and refresh every few seconds, so you
   can drive a whole round by yourself.

Local demo mode keeps everything inside that one browser. To have separate
laptops talk to each other, use a server (next section).

## C. Run it for several devices (one command)

This is how the real demo and the live session run. You need **Node.js 18+**
installed once (https://nodejs.org, the "LTS" download).

1. Open a terminal in this folder.
2. Run:

       node server.js

3. It prints two kinds of address, e.g.

       This computer:   http://localhost:8080
       Other devices:   http://192.168.1.42:8080   (same wifi/LAN)

4. On **every** laptop on the same network, open the **"Other devices"** URL.
   Each device picks its role. They're now all in one shared session.
   (For remote participants over the internet, the server needs a public
   address instead — see Section D.)

To stop the server, press `Ctrl+C`. Session data is saved to
`session-store.json` in this folder, so a restart resumes where it left off.
Delete that file (or use the facilitator's **Reset**) to start clean.

## D. Pointing the app at a specific server (the "three tests")

The server address is configurable **per device**, three ways, in priority order:

1. **Open the app from the server itself.** If a laptop opens
   `http://<server>/`, the app automatically uses that same server. Nothing to set.
2. **A link parameter.** Open `http://…/?server=https://test2.example.org`.
   The app saves that address on the device and uses it from then on.
3. **The "change" link** on the app's first screen. Paste in a server address,
   or leave it blank for local demo mode.

So switching between the three test environments is just giving people the URL
for that test. Nothing is hard-coded and nothing needs rebuilding.

---

## E. For IT — what the server has to do

The app needs two things from a host:

1. **Serve one static file** (`index.html`) over HTTP/HTTPS.
2. **Provide a tiny "key/value" endpoint** the app reads and writes. It is *not*
   a matter of many people editing one shared file (eight clients overwriting a
   single file would clobber each other). It's a handful of named values, each
   read and written independently:

       GET    /kv/{key}     -> 200 {"value":"<string>"}   or 404 if absent
       PUT    /kv/{key}     body {"value":"<string>"}      -> 200
       DELETE /kv/{key}                                    -> 200

   Values are small JSON strings. A session uses about ten keys
   (`mm:state` and `mm:team:1..6`), a few KB each. Enable **CORS**
   (`Access-Control-Allow-Origin`) if the app is served from a different origin
   than the API; if the same server does both, CORS isn't needed.

Load is trivial: ~8 devices, each polling once every 6 seconds (~1–2 requests/sec).

### Recommended web server

- **Simplest / recommended:** the included **`server.js`** *is* the web server and
  the key/value store in ~90 lines with **no dependencies** — it needs only Node.js.
  Run it on any machine (a laptop for the in-room November session, or a small
  cloud VM for the remote September demo). This is almost certainly the least work.
- **If you prefer a managed/standard stack:** put **Caddy** in front of `server.js`
  for automatic HTTPS (one-line config), or **nginx** as a reverse proxy. On cloud,
  **Azure App Service**, **AWS Lightsail/Elastic Beanstalk**, or any container host
  will run `server.js` directly.
- **If you'd rather not run Node at all:** any host that can expose the three
  endpoints above over a shared store works — e.g. **Firebase / Firestore** or
  **Supabase** (managed, generous free tier), or a few lines of PHP/Python/.NET
  in front of a database table or Redis. The app only cares about the three routes.

### Public vs. local
- **Remote participants (Sept demo over Zoom):** the address must be reachable
  from their own networks — a public HTTPS URL (cloud VM + Caddy, or a managed
  service). An internal-only address will not reach them.
- **Everyone in one room (Nov live):** run `server.js` on a laptop on the room's
  own network; no internet dependency, most resilient to venue wifi.

Cost is minimal: the in-house Node option runs on existing hardware for free;
a small cloud VM for the remote demo is a few dollars for the month.
