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

## A. Play with it right now (one computer, no install)

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

## B. Run it for several devices (one command)

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

## C. Pointing the app at a specific server (the "three tests")

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

## D. For IT — what the server has to do

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
