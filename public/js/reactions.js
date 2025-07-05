const ALLOWED_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "👎"];

let socket = null;
let myUsername = null;

/**
 * Initialize the reaction system with socket and username context.
 */
export function initReactions(io, username) {
  socket = io;
  myUsername = username;
}

/**
 * Adds the emoji reaction button to a message's timestamp area.
 */
export function addReactionButton(bubble, timeContainer, timestamp, isOutgoing) {
  const emojiBtn = document.createElement("button");
  emojiBtn.className = "reaction-emoji-button";
  emojiBtn.innerHTML = "<i class='far fa-smile'></i>";
  emojiBtn.title = "React";

  emojiBtn.onclick = (e) => {
    e.stopPropagation();
    showReactionPopup(e.currentTarget, bubble, timestamp);
  };

  // Place the reaction button relative to timestamp:
  if (isOutgoing) {
    // Outgoing (sent): button to the left of timestamp
    timeContainer.insertBefore(emojiBtn, timeContainer.firstChild);
  } else {
    // Incoming (received): button to the right of timestamp
    timeContainer.appendChild(emojiBtn);
  }
}

/**
 * Show reaction popup positioned just above the emoji button.
 */
function showReactionPopup(button, bubble, timestamp) {
  // Remove other open popups
  document.querySelectorAll(".reaction-popup").forEach(el => el.remove());

  const popup = document.createElement("div");
  popup.className = "reaction-popup";

  ALLOWED_REACTIONS.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className = "reaction-btn";
    btn.textContent = emoji;

    btn.onclick = (e) => {
      e.stopPropagation();
      const current = bubble.querySelector(".reaction-box")?.dataset[myUsername];
      const newEmoji = (current === emoji) ? null : emoji;
      socket.emit("react-message", { timestamp, emoji: newEmoji });
      popup.remove();
    };

    popup.appendChild(btn);
  });

  // Add popup inside the chat app container
  const chatContainer = document.querySelector(".chat-app");
  chatContainer.appendChild(popup);

  // Calculate position relative to button
  const buttonRect = button.getBoundingClientRect();
  const containerRect = chatContainer.getBoundingClientRect();

  const popupWidth = popup.offsetWidth || 120; // fallback estimate
  const popupHeight = popup.offsetHeight || 40;

  const top = buttonRect.top - containerRect.top - popupHeight - 8; // above button
  const left = buttonRect.left - containerRect.left + (buttonRect.width / 2) - (popupWidth / 2);

  popup.style.position = "absolute";
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

// Auto-dismiss popup when clicking elsewhere
document.addEventListener("click", () => {
  document.querySelectorAll(".reaction-popup").forEach(el => el.remove());
});

/**
 * Handle incoming reaction updates from socket.
 */
export function handleReactionUpdate({ timestamp, username, emoji }) {
  const bubble = document.querySelector(`.message[data-timestamp="${timestamp}"]`);
  if (!bubble) return;

  let box = bubble.querySelector(".reaction-box");
  if (!box) {
    box = document.createElement("div");
    box.className = "reaction-box";
    bubble.appendChild(box);
  }

  if (emoji) {
    box.dataset[username] = emoji;
  } else {
    delete box.dataset[username];
  }

  box.innerHTML = Object.values(box.dataset)
    .map(e => `<span class="reaction-tag">${e}</span>`)
    .join(" ");
}
