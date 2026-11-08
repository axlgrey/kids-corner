# Kids Corner

Small, kid-friendly web apps that work offline and can be installed on a phone
or tablet like a regular app (PWAs). Each app is plain HTML, CSS and
JavaScript with no build step.

Live site: <https://axlgrey.github.io/kids-corner/>

- Balloon Pop!: <https://axlgrey.github.io/kids-corner/k-balloons/src/>
- Color Fun!: <https://axlgrey.github.io/kids-corner/k-color/src/>
- Draw Fun!: <https://axlgrey.github.io/kids-corner/k-draw/src/>
- Drum Fun!: <https://axlgrey.github.io/kids-corner/k-drum/src/>
- Find It!: <https://axlgrey.github.io/kids-corner/k-find/src/>
- Match It!: <https://axlgrey.github.io/kids-corner/k-match/src/>
- Piano Fun!: <https://axlgrey.github.io/kids-corner/k-piano/src/>
- Silly Faces!: <https://axlgrey.github.io/kids-corner/k-camera/src/>

## Apps

| App | Folder | What it does |
|---|---|---|
| Balloon Pop! | [`k-balloons/src/`](k-balloons/src/) | A balloon popping game with funny sounds and power-ups. |
| Color Fun! | [`k-color/src/`](k-color/src/) | Pick a picture and tap areas to color them in. |
| Draw Fun! | [`k-draw/src/`](k-draw/src/) | A drawing book: pick a blank page or a picture to trace, and draw freehand. |
| Drum Fun! | [`k-drum/src/`](k-drum/src/) | Tap colorful pads, play drums and percussion, and learn simple rhythms. |
| Find It! | [`k-find/src/`](k-find/src/) | A 3D room game: look around and find the toys and treats that are asked for. |
| Match It! | [`k-match/src/`](k-match/src/) | An activity book: match words, numbers, letters, colors, shadows and body parts to pictures. |
| Piano Fun! | [`k-piano/src/`](k-piano/src/) | Tap colorful keys, switch instruments and learn simple songs. |
| Silly Faces! | [`k-camera/src/`](k-camera/src/) | A camera that puts glasses, clown noses, sleepy eyes and more on every face. |

## Balloon Pop!

- Pop balloons as they float up, with funny pop sounds (squeaks, boings,
  honks and more) and comic words.
- Timed game (3 minutes) in three levels: Easy, Normal and Hard, which change
  how many balloons appear, how fast they rise and how big they are.
- Endless mode with 3 lives; heart balloons give a life back.
- Special balloons: big (3 taps), tiny, gold (extra points), bunches, bombs
  that pop everything nearby, and gift balloons with power-ups: Tower, Super
  tap, Splash and Slow.
- Balloons can also be popped for fun on the start menu.
- Best scores for each mode are saved on the device. Pause, sound on/off and
  fullscreen buttons.
- Works fully offline, with the same update banner as Color Fun!.

## Color Fun!

- 46 line-art pictures in 6 categories: animals, transport, food, nature,
  places and space.
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

## Draw Fun!

- Opens as a drawing book: pick a category, then a page. Previews show each
  page with the drawing made on it so far.
- 8 blank pages, plus 34 pictures to trace in 5 categories: animals,
  transport, food, nature and places.
- Every page keeps its own drawing, saved on the device as you draw, so kids
  can come back to any page later.
- Brushes: pencil (soft graphite that catches the paper grain and builds up
  for shading), pen (ink that gets thinner when drawing fast), crayon (waxy
  texture), paint brush (bristle streaks that taper and fade) and eraser, in
  5 sizes with a 15-color palette. Pencil, pen and paint brush respond to
  stylus pressure.
- On picture pages the outline can be shown in front of the drawing (without
  covering it), behind it, or turned off, with adjustable color and opacity.
  Each page remembers its own outline settings.
- Undo (last 20 strokes), start over (clears the page and resets its outline
  settings; cannot be undone), save as a PNG and fullscreen mode.
- Works fully offline, with the same update banner as Color Fun!.

### Adding Tracing Pictures

Tracing pictures use the same SVG files and conventions as Color Fun!: save
the SVG as `k-draw/src/pictures/<category id>/<picture id>.svg`, add it to
`k-draw/src/catalog.js`, and bump `VERSION` in `k-draw/src/sw.js`.

## Drum Fun!

- 3 kits of 8 sounds each, all generated in the browser: Drums (crash,
  hi-hat, toms, ride, snare, clap, kick), Percussion (triangle, cowbell,
  tambourine, shaker, bongos, conga, wood block) and Silly (boing, pop, laser,
  bubble, quack, zap, whoosh, ding).
- Three views: a drawn drum kit, a grid of big pads, and a drum machine.
- Follow-along mode with 8 rhythms, such as Heartbeat, Rock Beat and Drum
  Roll. Kids can listen first, then play the highlighted pads.
- Drum machine: tap or drag across steps to make a beat, switch between 8
  and 16 steps, change the tempo, mute or solo each row, and load preset
  loops (e.g. Rock, Samba, Frog Dance). Beats are saved for each kit.
- Pad names can be toggled on or off; keys `Q W E R A S D F` play the pads
  on a keyboard.
- Works fully offline, with the same update banner as Color Fun!.

### Adding Rhythms

1. Add an entry to `RHYTHMS` in `k-drum/src/rhythms.js` with an `id`,
   `name`, `kit` and `hits`.
2. Write each hit as `PAD:BEATS`, where `PAD` is a pad id from that kit
   (beats default to 1). Use `-` for a rest.
3. Bump `VERSION` in `k-drum/src/sw.js`.

## Find It!

- A cosy 3D room: move the phone or tablet around (gyro) or drag to look,
  then tap the item that is asked for. Pinch or mouse wheel to zoom.
- 15 things to find, such as a teddy bear, candy, cake, rubber duck, toy car
  and ice cream.
- Three modes: Easy (3 big items, hint after 12 s), Normal (5 items, 3
  decoys, hint after 20 s) and Hard (7 small items, 5 decoys, hidden spots
  under the bed or behind the sofa). The best time per mode is saved.
- Each found item has its own sound, a funny word and confetti. Everything
  in the room reacts when tapped: the bed bounces, the door creaks, birds
  fly from the window and a cat wanders around.
- Hint arrow, task read aloud, and sound and gyro toggles.
- All 3D models are built from three.js shapes and all sounds are generated
  in the browser; the only asset is three.js itself (r170, MIT) in
  `k-find/src/vendor/`.
- The gyro needs HTTPS (or localhost) and, on iPhone/iPad, permission,
  which is asked when a mode is picked.
- Works fully offline, with the same update banner as Color Fun!.

Items live in `k-find/src/items.js` and the room in `k-find/src/room.js`;
bump `VERSION` in `k-find/src/sw.js` after changing them.

## Match It!

- Categories: Words, Numbers, ABC, Colors, Shadows, Best Friends (things that
  go together) and My Body, plus Surprise! which mixes them all.
- Two ways to play: Pick (tap the matching picture, 6 per round) or Draw
  lines (connect each item to its match).
- Questions are read aloud; voice and sounds can each be turned off.
- Earn stars per category and collect stickers in a sticker book. Progress
  is saved on the device.
- Works fully offline, with the same update banner as Color Fun!.

Categories and stickers live in `k-match/src/data.js`; bump `VERSION` in
`k-match/src/sw.js` after changing them.

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

## Silly Faces!

- Live face tracking of up to 4 faces; the chosen items go on every face and
  follow head tilt and size.
- 16 items, pick as many as you like: glasses, clown nose, sleepy eyes (with
  floating Zzz), googly eyes, heart eyes, star eyes, mustache, silly tongue,
  piggy nose, kitty whiskers, rosy cheeks, party hat, crown, bunny ears,
  alien antennae and a big beard.
- Each item pops in with its own sound (boing, honk, snore, oink, meow and
  more) generated in the browser, plus an emoji burst.
- Open your mouth wide for a "wow" and confetti; tap a face to make it
  giggle.
- Random silly look, remove all, sound on/off, front/back camera switch, and
  take and save a photo.
- Face tracking runs entirely on the device with TensorFlow.js and
  face-landmarks-detection (Apache-2.0), vendored with their models in
  `k-camera/src/vendor/tfjs/`. No video or usage data leaves the device.
- The camera needs HTTPS (or localhost) and permission from the browser.
- Works fully offline, with the same update banner as Color Fun!.

Items live in `k-camera/src/items.js`: each has an `anchor` (`eyes`,
`nose`, `lip`, `mouth`, `chin`, `top`), a `layer`, a `sound` from `SOUNDS`
in `k-camera/src/app.js` and a `draw(ctx, face, t)` function, measured in
eye distances. Bump `VERSION` in `k-camera/src/sw.js` after changing them.

## Adding a New App

1. Create a folder such as `my-app/src/` containing an `index.html` and a
   `manifest.webmanifest`. Use relative paths (`./`, `app.js`), because the
   site is served from `/kids-corner/`, not the domain root.
2. Add a card for it to the home page (`index.html`), using the app's name,
   description, `theme_color` and icon from its manifest. The publishing
   helper can generate these cards automatically from every manifest it
   finds.

## Running Locally

Service workers need a web server, so opening `index.html` directly from disk
will not work offline. From the repository folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.
