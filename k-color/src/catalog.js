// Picture catalog: categories and the pictures in each.
// Each picture lives in its own file: pictures/<category id>/<picture id>.svg
// See README.md ("Adding Pictures") for the SVG conventions.
const CATEGORIES = [
  {
    id: "animals", name: "Animals", icon: "🐶", color: "#fb5607",
    pictures: [
      { id: "cat", name: "Cat" },
      { id: "fish", name: "Fish" },
      { id: "turtle", name: "Turtle" },
      { id: "butterfly", name: "Butterfly" },
      { id: "lion", name: "Lion" },
      { id: "panther", name: "Panther" },
      { id: "hamster", name: "Hamster" },
      { id: "mouse", name: "Mouse" }
    ]
  },
  {
    id: "transport", name: "Transport", icon: "🚗", color: "#3a86ff",
    pictures: [
      { id: "car", name: "Car" },
      { id: "airplane", name: "Airplane" },
      { id: "boat", name: "Boat" },
      { id: "train", name: "Train" },
      { id: "bus", name: "Bus" },
      { id: "helicopter", name: "Helicopter" },
      { id: "rocket", name: "Rocket" }
    ]
  },
  {
    id: "places", name: "Places", icon: "🏠", color: "#06d6a0",
    pictures: [
      { id: "house", name: "House" },
      { id: "castle", name: "Castle" },
      { id: "beach", name: "Beach" },
      { id: "lighthouse", name: "Lighthouse" },
      { id: "camping", name: "Camping" },
      { id: "school", name: "School" }
    ]
  },
  {
    id: "nature", name: "Nature", icon: "🌳", color: "#2a9d8f",
    pictures: [
      { id: "flower", name: "Flower" },
      { id: "tree", name: "Tree" },
      { id: "rainbow", name: "Rainbow" },
      { id: "sun", name: "Sun" },
      { id: "mushroom", name: "Mushroom" },
      { id: "cactus", name: "Cactus" }
    ]
  },
  {
    id: "food", name: "Food", icon: "🍎", color: "#e63946",
    pictures: [
      { id: "apple", name: "Apple" },
      { id: "ice-cream", name: "Ice Cream" },
      { id: "cupcake", name: "Cupcake" },
      { id: "pizza", name: "Pizza" },
      { id: "donut", name: "Donut" },
      { id: "watermelon", name: "Watermelon" },
      { id: "cake", name: "Cake" }
    ]
  }
];
