// Rhythms for follow-along mode. Each hit is "PAD:BEATS" (beats default 1).
// PAD is a pad id from the rhythm's kit (see KITS in app.js). Use "-" for a rest.
const RHYTHMS = [
  {
    id: "heartbeat",
    name: "💓 Heartbeat",
    kit: "drums",
    hits: "kick:0.5 kick:1.5 kick:0.5 kick:1.5 kick:0.5 kick:1.5 kick:0.5 kick:1.5"
  },
  {
    id: "rock",
    name: "🎸 Rock Beat",
    kit: "drums",
    hits: "kick snare kick snare kick:0.5 kick:0.5 snare kick snare:2"
  },
  {
    id: "march",
    name: "🥁 Little March",
    kit: "drums",
    hits: "snare:0.5 snare:0.5 snare tom:0.5 tom:0.5 tom snare:0.5 snare:0.5 snare:0.5 snare:0.5 crash:2"
  },
  {
    id: "wewill",
    name: "👏 Stomp Stomp Clap",
    kit: "drums",
    hits: "kick:0.5 kick:0.5 clap - kick:0.5 kick:0.5 clap - kick:0.5 kick:0.5 clap - kick:0.5 kick:0.5 clap:2"
  },
  {
    id: "fill",
    name: "🌊 Drum Roll",
    kit: "drums",
    hits: "hihat:0.5 hihat:0.5 snare:0.5 snare:0.5 tom:0.5 tom:0.5 floor:0.5 floor:0.5 crash:2"
  },
  {
    id: "conga",
    name: "🌴 Bongo Party",
    kit: "percussion",
    hits: "bongohi:0.5 bongohi:0.5 bongolo conga:0.5 conga:0.5 bongolo bongohi:0.5 bongohi:0.5 bongolo:0.5 conga:0.5 shaker:2"
  },
  {
    id: "jingle",
    name: "🔔 Jingle Shake",
    kit: "percussion",
    hits: "tambourine tambourine tambourine:2 tambourine tambourine tambourine:2 cowbell triangle shaker woodblock triangle:2"
  },
  {
    id: "clock",
    name: "⏰ Tick Tock",
    kit: "percussion",
    hits: "woodblock:0.5 woodblock:0.5 woodblock:0.5 woodblock:0.5 woodblock:0.5 woodblock:0.5 woodblock:0.5 woodblock:0.5 triangle:2"
  }
].map((rhythm) => ({
  ...rhythm,
  hits: rhythm.hits.trim().split(/\s+/).map((token) => {
    const [pad, beats] = token.split(":");
    return { pad, beats: beats ? parseFloat(beats) : 1 };
  })
}));
