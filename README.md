# Kids Corner

Small, kid-friendly web apps that work offline and can be installed on a phone
or tablet like a regular app (PWAs). Each app is plain HTML, CSS and
JavaScript with no build step.

Live site: `https://<owner>.github.io/kids-corner/`

## Apps

| App | Folder | What it does |
|---|---|---|
| Color Fun! | [`k-color/src/`](k-color/src/) | Pick a picture and tap areas to color them in. |

## Color Fun!

- 34 line-art pictures in 5 categories: animals, transport, food, nature and
  places.
- Big color swatches, undo, clear, save as image and fullscreen mode.
- Colorings are saved on the device, so kids can come back to them later.
- Works fully offline once loaded; a banner offers to refresh when a new
  version is published.

### Adding Pictures

1. Draw the picture as an SVG with `viewBox="0 0 200 200"` and save it as
   `k-color/src/pictures/<category id>/<picture id>.svg`.
2. Add it to the category's `pictures` list in `k-color/src/catalog.js`, e.g.
   `{ id: "dog", name: "Dog" }`.
3. Bump `VERSION` in `k-color/src/sw.js` so installed copies pick up the
   change.

SVG conventions:

- Leave out `fill` and `stroke`; the app adds a dark outline to every shape.
- Every shape without a class becomes a tappable area that starts out white.
- `class="n"`: outline only, not colorable (use for details such as smiles).
- `class="k"`: solid black, not colorable (e.g. pupils).
- `class="w"`: solid white with no outline, not colorable (e.g. eye shine).
- Set `stroke-width` on a shape to override the default of `3`.
- Draw later shapes on top of earlier ones, just as SVG renders them.

## Adding a New App

1. Create a folder such as `my-app/src/` containing an `index.html` and a
   `manifest.webmanifest`. Use relative paths (`./`, `app.js`), because the
   site is served from `/kids-corner/`, not the domain root.
2. Run `./wrapper.sh --init` from the parent folder. It finds every
   `manifest.webmanifest` and adds a button for it to the home page
   (`index.html`), labelled with the manifest's `name`.

## Running Locally

Service workers need a web server, so opening `index.html` directly from disk
will not work offline. From the repository folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deployment

Every push to `main` publishes the repository to GitHub Pages through
`.github/workflows/pages.yml`. In the repository settings, set
**Settings → Pages → Source** to **GitHub Actions** once.

The helper script one folder up does the setup and pushing:

```bash
./wrapper.sh --load .env --init --push
```

- `--load FILE` reads `GH_USERNAME`, `GH_PASSWORD` (a personal access token)
  and `GH_URL` from a `KEY=value` file. Keep that file outside this
  repository.
- `--init` regenerates the home page and the Pages workflow. It is safe to run
  repeatedly.
- `--push` commits any changes and pushes to `main`.
