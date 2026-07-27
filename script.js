// ===============================
// Wolf Cards
// ===============================

// -------- Setup --------

let wolves = 2;
let villagers = 4;

const wolfValue = document.getElementById("wolfValue");
const villagerValue = document.getElementById("villagerValue");

document.getElementById("wolfPlus").onclick = () => {
  wolves++;
  updateCounters();
};

document.getElementById("wolfMinus").onclick = () => {
  if (wolves > 1) wolves--;
  updateCounters();
};

document.getElementById("villagerPlus").onclick = () => {
  villagers++;
  updateCounters();
};

document.getElementById("villagerMinus").onclick = () => {
  if (villagers > 1) villagers--;
  updateCounters();
};

function updateCounters() {
  wolfValue.textContent = wolves;
  villagerValue.textContent = villagers;
}

updateCounters();

// ===============================
// Screens
// ===============================

const pages = document.querySelectorAll(".page");

function showPage(id) {
  pages.forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===============================
// Game Variables
// ===============================

let deck = [];
let currentPlayer = 0;

const playerNumber = document.getElementById("playerNumber");
const card = document.getElementById("card");
const role = document.getElementById("role");
const emoji = document.getElementById("emoji");
const description = document.getElementById("description");
const hideBtn = document.getElementById("hideBtn");
const nextPlayer = document.getElementById("nextPlayer");

// ===============================
// Create Deck
// ===============================

function createDeck() {
  deck = [];

  // Wolves
  for (let i = 1; i <= wolves; i++) {
    deck.push({
      role: "Wolf",
      wolfNumber: i,
      emoji: "🐺",
      description: `You are Wolf ${i}. Work with the other wolves every night.`
    });
  }

  // Villagers
  for (let i = 0; i < villagers; i++) {
    deck.push({
      role: "Villager",
      emoji: "🧑",
      description: "Find and eliminate every wolf."
    });
  }

  // Doctor
  if (document.getElementById("doctor").checked) {
    deck.push({
      role: "Doctor",
      emoji: "🩺",
      description: "Choose one player to protect every night."
    });
  }

  // Sheriff
  if (document.getElementById("sheriff").checked) {
    deck.push({
      role: "Sheriff",
      emoji: "👮",
      description: "Investigate one player every night."
    });
  }

  shuffle(deck);
}

// ===============================
// Shuffle
// ===============================

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ===============================
// Start Game
// ===============================

document.getElementById("startBtn").onclick = () => {

  createDeck();

  currentPlayer = 0;

  showPage("shuffle");

  setTimeout(() => {
    loadPlayer();
  }, 2500);

};

// ===============================
// Load Player
// ===============================

function loadPlayer() {

  showPage("player");

  playerNumber.textContent = "Player " + (currentPlayer + 1);

  card.classList.remove("flip");

  hideBtn.classList.add("hidden");

}

// ===============================
// Reveal Card
// ===============================

card.onclick = () => {

  if (card.classList.contains("flip")) return;

  const r = deck[currentPlayer];

  if (r.role === "Wolf") {
    role.textContent = `Wolf ${r.wolfNumber}`;
  } else {
    role.textContent = r.role;
  }

  emoji.textContent = r.emoji;
  description.textContent = r.description;

  card.classList.add("flip");

  hideBtn.classList.remove("hidden");

};

// ===============================
// Hide Card
// ===============================

hideBtn.onclick = () => {

  currentPlayer++;

  if (currentPlayer >= deck.length) {

    showPage("finish");

    return;

  }

  nextPlayer.textContent =
    "Give the phone to Player " + (currentPlayer + 1);

  showPage("pass");

};

// ===============================
// Continue
// ===============================

document.getElementById("continueBtn").onclick = () => {

  loadPlayer();

};

// ===============================
// Restart
// ===============================

document.getElementById("restartBtn").onclick = () => {

  showPage("setup");

};

// ===============================
// Home Button
// ===============================

document.getElementById("homeBtn").onclick = () => {

  const answer = confirm(
    "Return to the home page?\n\nThe current game will be lost."
  );

  if (!answer) return;

  showPage("setup");

  currentPlayer = 0;

  deck = [];

  card.classList.remove("flip");

  hideBtn.classList.add("hidden");

};
