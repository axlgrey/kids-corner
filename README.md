# Kids Corner

Small, kid-friendly web apps that work offline and can be installed on a phone
or tablet like a regular app (PWAs). Each app is plain HTML, CSS and
JavaScript with no build step.

Live site: `https://<owner>.github.io/kids-corner/`

## Apps

| App | Folder | What it does |
|---|---|---|
| Color Fun! | [`k-color/src/`](k-color/src/) | Pick a picture and tap areas to color them in. |
| Piano Fun! | [`k-piano/src/`](k-piano/src/) | Tap colorful keys, switch instruments and learn simple songs. |

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

## Piano Fun!

- Colorful two-octave keyboard (C4 to C6), with sounds generated in the
  browser, so no audio files are needed.
- 5 instruments: piano, bells, organ, robot and kitty.
- Follow-along mode with 6 songs: Twinkle Twinkle, Mary Had a Little Lamb,
  Happy Birthday, Row Your Boat, Jingle Bells and Ode to Joy. Kids can listen
  first, then play the highlighted keys.
- Note names can be toggled on or off; the chosen instrument and label setting
  are remembered on the device.
- Works fully offline, with the same update banner as Color Fun!.

### Adding Songs

1. Add an entry to `SONGS` in `k-piano/src/songs.js`, e.g.
   `{ id: "frere", name: "🔔 Frere Jacques", notes: "C4 D4 E4 C4" }`.
2. Write each note as `NAME:BEATS` (beats default to 1, so `G4:2` is twice
   as long). Sharps use `#`, e.g. `A#4`. Notes must be between C4 and C6.
3. Bump `VERSION` in `k-piano/src/sw.js`.

## Adding a New App

1. Create a folder such as `my-app/src/` containing an `index.html` and a
   `manifest.webmanifest`. Use relative paths (`./`, `app.js`), because the
   site is served from `/kids-corner/`, not the domain root.
2. Add a card for it to the home page (`index.html`), using the app's name,
   description, `theme_color` and icon from its manifest.

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
