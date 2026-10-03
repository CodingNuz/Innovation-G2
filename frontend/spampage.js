// ==========================================================
// SpamChameleon – script.js
// Frontend logic with MOCK predictions (no backend needed yet)
// ==========================================================

// ---------- DOM elements ----------
const mainEl        = document.getElementById("main");
const messageInput  = document.getElementById("input");
const checkBtn      = document.getElementById("checkbutt");
const closeBtn      = document.getElementById("closebutt");
const resultPanel   = document.getElementById("sidepanel");
const resultText    = document.getElementById("resulttext");
const resultFlag    = document.getElementById("resultflag");
const susList       = document.getElementById("suslist");
const aboutBtn      = document.getElementById("aboutbutt");
const aboutModal    = document.getElementById("AUbox");
const aboutCloseBtn = document.getElementById("aboutclose");

// ---------- Button state ----------
// Enable "Check" only when the textarea contains some text.
function updateCheckButton() {
  checkBtn.disabled = messageInput.value.trim() === "";
}
messageInput.addEventListener("input", updateCheckButton);
updateCheckButton(); // run once on page load


// ---------- Result display ----------
function handleCheck() {
  const message = messageInput.value.trim();
  if (message === "") return;

  showResult();
}

function showResult() {
  resultPanel.hidden = false;
  mainEl.classList.add("has-result");
}

checkBtn.addEventListener("click", handleCheck);

// ---------- Close result ----------
// Hides the result panel; the typed message is kept.
function closeResult() {
  resultPanel.hidden = true;
  mainEl.classList.remove("has-result");
}
closeBtn.addEventListener("click", closeResult);

// ---------- About Us ----------
function openAbout()  { aboutModal.hidden = false; aboutCloseBtn.focus(); }
function closeAbout() { aboutModal.hidden = true; aboutBtn.focus(); }

aboutBtn.addEventListener("click", openAbout);
aboutCloseBtn.addEventListener("click", closeAbout);

