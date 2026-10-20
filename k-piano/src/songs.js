// Songs for follow-along mode. Each note is "NAME:BEATS" (beats default 1).
// Note names must be on the keyboard (C4 to C6).
const SONGS = [
  {
    id: "twinkle",
    name: "⭐ Twinkle Twinkle",
    notes: "C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2"
  },
  {
    id: "mary",
    name: "🐑 Mary Had a Little Lamb",
    notes: "E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4"
  },
  {
    id: "birthday",
    name: "🎂 Happy Birthday",
    notes: "C4:0.75 C4:0.25 D4 C4 F4 E4:2 C4:0.75 C4:0.25 D4 C4 G4 F4:2 C4:0.75 C4:0.25 C5 A4 F4 E4 D4:2 A#4:0.75 A#4:0.25 A4 F4 G4 F4:2"
  },
  {
    id: "rowboat",
    name: "🚣 Row Your Boat",
    notes: "C4:1.5 C4:1.5 C4 D4:0.5 E4:1.5 E4 D4:0.5 E4 F4:0.5 G4:3 C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 G4 F4:0.5 E4 D4:0.5 C4:3"
  },
  {
    id: "jingle",
    name: "🔔 Jingle Bells",
    notes: "E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2"
  },
  {
    id: "ode",
    name: "🎼 Ode to Joy",
    notes: "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2"
  }
].map((song) => ({
  ...song,
  notes: song.notes.trim().split(/\s+/).map((token) => {
    const [note, beats] = token.split(":");
    return { note, beats: beats ? parseFloat(beats) : 1 };
  })
}));
