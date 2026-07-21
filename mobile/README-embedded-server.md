# Open Historia Android — embedded server

The app used to be a thin WebView that connected to a server you had to run
yourself (Termux, or a PC on your Wi‑Fi). It now **runs the real Open Historia
server in-process on the phone** via [`nodejs-mobile`], so there's nothing to set
up — launch it and play. You can still point it at a remote server if you want.

## How it works

```
mobile/www/index.html      boot screen → starts the node server → connects to 127.0.0.1:3000
mobile/nodejs-project/
  main.js                  (committed) entry nodejs-mobile runs: picks a writable
                           data dir, seeds defaults, starts server/server.js
  fetchMapAssets.mjs       (committed) first-run download of the map binaries
  server/ dist/ public/    (assembled) copied by scripts/build-mobile-server.mjs
  seed/ node_modules/      (assembled) default scenarios + express
  package.json map-assets.json (assembled)
```

- The server writes to a **writable** data dir (`OH_DATA_DIR`, resolved in
  `server/dataDir.js`) because the bundled `server/data` is read-only inside the
  APK. Default is a folder next to `main.js` (nodejs-mobile extracts the project
  to a writable location).
- **First run** seeds the default scenarios from `seed/` and downloads the
  ~200 MB of map binaries (pmtiles/geojson) from the GitHub Release into
  `OH_DATA_DIR/assets` and `OH_DATA_DIR/scenarios/…`. The server's pmtiles route
  serves them from there (`resolveRuntimeBinaryAsset` prefers the fetched copy).
- The server's only npm runtime dependency is **express**, so the bundled
  `node_modules` is tiny (~3.4 MB); everything else is Node built-ins.

## Status — what's verified vs. what still needs a device

**Verified on desktop (Node):**
- `server/dataDir.js` + all stores honour `OH_DATA_DIR`; desktop/Termux are
  byte-identical when it's unset.
- `main.js` seeds a fresh data dir and starts the real server (`/api/library` →
  200, 7 default scenarios).
- `scripts/build-mobile-server.mjs` assembles a lean project (dist 21 MB after
  stripping tiles, node_modules 3.4 MB, seed has zero heavy files).
- The pmtiles route serves the fetched file from `OH_DATA_DIR/assets` (desktop
  still serves from the bundle).

**NOT yet done / needs on-device work (I can't build or run an APK):**
1. **Install the plugin and regenerate the native project** — the one manual step:
   ```sh
   cd mobile
   npm i nodejs-mobile-cordova
   npx cap sync android      # copies mobile/nodejs-project into the app + wires the plugin
   ```
   Confirm `window.nodejs` exists in the WebView and `nodejs.start("main.js", …)`
   boots the server (the boot screen calls exactly this).
2. **Verify the boot flow on a device** — cold start time, the 90 s server-wait
   window in `index.html`, and the ~200 MB first-run map download UX.
3. **APK size / ABIs** — nodejs-mobile adds a native libnode per ABI; check the
   APK size and split per-ABI if needed.
4. **CI** — `.github/workflows/android-apk.yml` now builds `dist` and assembles
   the node project, but the APK step needs the plugin from step 1 committed to
   `mobile/` for `cap sync` to bundle it.

## Build & test locally

```sh
# from the repo root
npm ci
npm run build                 # produces dist/
npm run build:mobile-server   # assembles mobile/nodejs-project/ (installs express)

# exercise the embedded entry exactly as the phone will (desktop Node):
OH_DATA_DIR=/tmp/oh PORT=3000 node mobile/nodejs-project/main.js
#   → seeds /tmp/oh, downloads the map (~200 MB), serves http://127.0.0.1:3000

# then the APK (after installing the plugin, step 1 above):
cd mobile && npx cap sync android && cd android && ./gradlew assembleDebug
```

The assembled `mobile/nodejs-project/{server,dist,public,seed,node_modules,…}`
is **build output** and is git-ignored; only `main.js`, `fetchMapAssets.mjs`, and
`.gitignore` are committed.

[`nodejs-mobile`]: https://github.com/nodejs-mobile/nodejs-mobile-cordova
