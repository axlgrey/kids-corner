// Activity book content. Each category builds a pool of items:
//   key:    unique id (also used to avoid duplicate choices)
//   prompt: what the child matches FROM (shown on the left / at the top)
//   kind:   how the prompt is drawn ("word", "number", "letter", "color", "shadow", "emoji")
//   answer: emoji picture to match TO (string, or { emoji, count } for counting)
//   say:    text read out by the voice
window.MatchData = (() => {
  const WORDS = [
    ["car", "🚗"], ["dog", "🐶"], ["cat", "🐱"], ["sun", "☀️"], ["ball", "⚽"],
    ["fish", "🐟"], ["tree", "🌳"], ["cake", "🎂"], ["bus", "🚌"], ["duck", "🦆"],
    ["moon", "🌙"], ["star", "⭐"], ["hat", "🎩"], ["bed", "🛏️"], ["egg", "🥚"],
    ["pig", "🐷"], ["frog", "🐸"], ["boat", "⛵"], ["shoe", "👟"], ["book", "📖"],
    ["apple", "🍎"], ["house", "🏠"], ["train", "🚂"], ["horse", "🐴"], ["rocket", "🚀"]
  ];

  const ALPHABET = [
    ["A", "alligator", "🐊"], ["B", "bear", "🐻"], ["C", "cat", "🐱"], ["D", "dog", "🐶"],
    ["E", "elephant", "🐘"], ["F", "fish", "🐟"], ["G", "giraffe", "🦒"], ["H", "horse", "🐴"],
    ["I", "ice cream", "🍦"], ["J", "jellyfish", "🪼"], ["K", "kangaroo", "🦘"], ["L", "lion", "🦁"],
    ["M", "monkey", "🐵"], ["N", "nest", "🪺"], ["O", "octopus", "🐙"], ["P", "penguin", "🐧"],
    ["Q", "queen", "👸"], ["R", "rabbit", "🐰"], ["S", "snake", "🐍"], ["T", "turtle", "🐢"],
    ["U", "umbrella", "☂️"], ["V", "violin", "🎻"], ["W", "whale", "🐳"], ["X", "xylophone", "🎼"],
    ["Y", "yo-yo", "🪀"], ["Z", "zebra", "🦓"]
  ];

  const COUNT_THINGS = [
    ["apples", "🍎"], ["stars", "⭐"], ["ducks", "🦆"], ["balloons", "🎈"], ["cookies", "🍪"],
    ["flowers", "🌸"], ["fish", "🐟"], ["cars", "🚗"], ["bananas", "🍌"], ["hearts", "❤️"]
  ];

  const COLORS = [
    ["red", "#e63946", ["🍓", "🍎", "🚒", "🍅"]],
    ["yellow", "#ffd60a", ["🍌", "🌻", "🐤", "🧀"]],
    ["green", "#2a9d8f", ["🐸", "🥦", "🐢", "🥒"]],
    ["blue", "#3a86ff", ["🐳", "🫐", "💧", "🦋"]],
    ["orange", "#fb8500", ["🍊", "🥕", "🎃", "🦊"]],
    ["purple", "#9d4edd", ["🍇", "🍆", "☂️", "🔮"]],
    ["pink", "#ff8fab", ["🐷", "🌸", "🦩", "🎀"]],
    ["brown", "#8d5524", ["🐻", "🍫", "🥔", "🪵"]],
    ["white", "#ffffff", ["⛄", "🐑", "☁️", "🥛"]],
    ["black", "#222222", ["🎱", "🕷️", "🐜", "🎩"]]
  ];

  const SHADOWS = [
    "🐘", "🦒", "🐇", "🦕", "🐌", "🦀", "🐢", "🦋", "🚲", "✈️",
    "🎸", "🐓", "🦔", "🐬", "🍐", "🦜", "🐿️", "🏰", "🚁", "🦄"
  ];

  const FRIENDS = [
    ["🐝", "🍯", "bee", "honey"], ["🐶", "🦴", "dog", "bone"], ["🐵", "🍌", "monkey", "banana"],
    ["🐰", "🥕", "bunny", "carrot"], ["🐭", "🧀", "mouse", "cheese"], ["🐄", "🥛", "cow", "milk"],
    ["🐔", "🥚", "hen", "egg"], ["🐼", "🎋", "panda", "bamboo"], ["🧦", "👟", "sock", "shoe"],
    ["🔑", "🔒", "key", "lock"], ["🪥", "🦷", "toothbrush", "tooth"], ["☔", "🌧️", "umbrella", "rain"],
    ["⚾", "🧢", "baseball", "cap"], ["🍪", "🥛", "cookie", "milk"], ["✏️", "📝", "pencil", "paper"],
    ["🐿️", "🌰", "squirrel", "nut"], ["🐱", "🧶", "cat", "yarn"], ["🐟", "🫧", "fish", "bubbles"]
  ];

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const CATEGORIES = [
    {
      id: "words", name: "Words", icon: "🚗", color: "#3a86ff",
      ask: (it) => `Which one is ${it.say}?`,
      pool: () => WORDS.map(([word, emoji]) => ({
        key: word, kind: "word", prompt: word, answer: emoji, say: word
      }))
    },
    {
      id: "numbers", name: "Numbers", icon: "🔢", color: "#8ac926",
      ask: (it) => `Find ${it.say}!`,
      pool: () => {
        const [name, emoji] = pick(COUNT_THINGS);
        return Array.from({ length: 10 }, (_, i) => ({
          key: String(i + 1), kind: "number", prompt: String(i + 1),
          answer: { emoji, count: i + 1 }, say: `${i + 1} ${i === 0 ? name.replace(/s$/, "") : name}`
        }));
      }
    },
    {
      id: "letters", name: "ABC", icon: "🔤", color: "#e63946",
      ask: (it) => `${it.prompt} is for... ?`,
      pool: () => ALPHABET.map(([letter, word, emoji]) => ({
        key: letter, kind: "letter", prompt: letter, answer: emoji, say: word,
        reveal: `${letter} is for ${word}!`
      }))
    },
    {
      id: "colors", name: "Colors", icon: "🎨", color: "#ff9f1c",
      ask: (it) => `What is ${it.say}?`,
      pool: () => COLORS.map(([name, hex, things]) => ({
        key: name, kind: "color", prompt: hex, answer: pick(things), say: name
      }))
    },
    {
      id: "shadows", name: "Shadows", icon: "👤", color: "#6c757d",
      ask: () => "Whose shadow is this?",
      pool: () => SHADOWS.map((emoji) => ({
        key: emoji, kind: "shadow", prompt: emoji, answer: emoji, say: "", reveal: "You found it!"
      }))
    },
    {
      id: "friends", name: "Best Friends", icon: "🐝", color: "#9d4edd",
      ask: (it) => `What goes with the ${it.from}?`,
      pool: () => FRIENDS.map(([a, b, from, to]) => ({
        key: a, kind: "emoji", prompt: a, answer: b, say: to, from,
        reveal: `${from} and ${to}!`
      }))
    },
    {
      id: "mix", name: "Surprise!", icon: "🎁", color: "#ff006e",
      mix: true
    }
  ];

  const STICKERS = [
    "🦄", "🐲", "🦖", "🐙", "🦊", "🐼", "🐨", "🦁", "🐯", "🐸", "🐧", "🦉",
    "🦋", "🐞", "🐬", "🦈", "🐳", "🦩", "🦚", "🌈", "🚀", "🛸", "🚒", "🚜",
    "🏎️", "🚂", "⛵", "🎈", "🍩", "🍭", "🍉", "🍕", "🧁", "🍦", "🎂", "⚽",
    "🎸", "🥁", "👑", "💎", "🌟", "🌻", "🍄", "🌵", "🐢", "🦕", "🤖", "👻"
  ];

  return { CATEGORIES, STICKERS };
})();
