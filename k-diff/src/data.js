// Scenes for Spot It! Pictures are emoji placed on a themed background.
window.DiffData = (() => {
  const THEMES = [
    {
      id: "park", name: "Park", icon: "🌳",
      sky: "linear-gradient(#8ecae6 0 55%, #8ac926 55% 100%)",
      deco: [{ e: "☀️", x: 88, y: 12, s: 14 }, { e: "☁️", x: 20, y: 12, s: 12 }],
      things: ["🌳", "🌷", "🐶", "🐱", "🦋", "🐝", "🍄", "🌻", "🐿️", "🐌", "🪁", "⚽", "🐦", "🦆", "🐞", "🌲", "🛝", "🍎"]
    },
    {
      id: "sea", name: "Sea", icon: "🐠",
      sky: "linear-gradient(#48cae4, #0077b6 80%, #e9c46a 80%)",
      deco: [{ e: "🫧", x: 10, y: 20, s: 8 }, { e: "🫧", x: 92, y: 40, s: 7 }],
      things: ["🐠", "🐟", "🐡", "🦈", "🐙", "🦀", "🐳", "🐬", "🦑", "🐚", "🪸", "⭐", "🦞", "🐢", "🪼", "🦐", "🌿", "⚓"]
    },
    {
      id: "space", name: "Space", icon: "🚀",
      sky: "radial-gradient(circle at 30% 30%, #3c096c, #10002b 70%)",
      deco: [{ e: "✨", x: 50, y: 8, s: 7 }, { e: "✨", x: 8, y: 85, s: 6 }],
      things: ["🚀", "🪐", "🌙", "⭐", "👽", "🛸", "☄️", "🌍", "🛰️", "👾", "🌟", "🌞", "🔭", "🧑‍🚀", "🌑", "💫", "🌕", "🤖"]
    },
    {
      id: "farm", name: "Farm", icon: "🐮",
      sky: "linear-gradient(#bde0fe 0 45%, #a7c957 45% 100%)",
      deco: [{ e: "🌤️", x: 85, y: 12, s: 14 }],
      things: ["🐮", "🐷", "🐔", "🐑", "🐴", "🦆", "🐓", "🐐", "🚜", "🌽", "🥕", "🐣", "🏡", "🌾", "🐇", "🐕", "🥚", "🍅"]
    },
    {
      id: "kitchen", name: "Kitchen", icon: "🍰",
      sky: "linear-gradient(#ffe5ec 0 60%, #c9ada7 60% 100%)",
      deco: [{ e: "🪟", x: 15, y: 15, s: 14 }],
      things: ["🍰", "🍕", "🍌", "🍎", "🥛", "🍪", "🧁", "🍩", "🫖", "🍳", "🥕", "🧀", "🍓", "🍉", "🥨", "🍭", "🍯", "🥄"]
    },
    {
      id: "monsters", name: "Silly Town", icon: "🤪",
      sky: "linear-gradient(135deg, #ffafcc, #cdb4db, #a2d2ff)",
      deco: [{ e: "🌈", x: 50, y: 10, s: 16 }],
      things: ["🤪", "👻", "🤡", "🦄", "🐸", "💩", "🙈", "🦖", "🐵", "🎃", "🧟", "🐙", "🤖", "🎈", "🧸", "🦩", "🐧", "🍔"]
    }
  ];

  // How a picture can be different. `apply` changes the copy of an item.
  const CHANGES = [
    { id: "gone", say: "It ran away!", apply: (it) => { it.gone = true; } },
    { id: "swap", say: "Switcheroo!", apply: (it, theme) => {
      const others = theme.things.filter((e) => e !== it.e);
      it.e = others[Math.floor(Math.random() * others.length)];
    } },
    { id: "color", say: "New colors!", apply: (it) => { it.hue = 90 + Math.floor(Math.random() * 180); } },
    { id: "flip", say: "Upside down!", apply: (it) => { it.flip = "y"; } },
    { id: "big", say: "Big and small!", apply: (it) => { it.s = it.s * (Math.random() < 0.5 ? 1.7 : 0.55); } }
  ];

  const MODES = [
    { id: "easy", name: "Easy", icon: "🐣", diffs: 3, things: 7, size: [15, 19] },
    { id: "normal", name: "Normal", icon: "🐶", diffs: 5, things: 10, size: [12, 16] },
    { id: "hard", name: "Hard", icon: "🦁", diffs: 7, things: 14, size: [9, 13] }
  ];

  return { THEMES, CHANGES, MODES };
})();
