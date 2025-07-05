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
export function addReactionButton(bubble, timeContainer, timestamp, isOutgoing, toUser) {
  const emojiBtn = document.createElement("button");
  emojiBtn.className = "reaction-emoji-button";
  emojiBtn.innerHTML = "<i class='far fa-smile'></i>";
  emojiBtn.title = "React";

  emojiBtn.onclick = (e) => {
    e.stopPropagation();
    showReactionPopup(e.currentTarget, bubble, timestamp, toUser);
  };

  if (isOutgoing) {
    timeContainer.insertBefore(emojiBtn, timeContainer.firstChild);
  } else {
    timeContainer.appendChild(emojiBtn);
  }
}

/**
 * Show reaction popup positioned just above the emoji button.
 * Now includes bounds-checking to prevent overflow.
 */
function showReactionPopup(button, bubble, timestamp, toUser) {
  // Remove any open popups
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

      socket.emit("react-message", {
        from: myUsername,
        to: toUser,
        timestamp,
        emoji: newEmoji
      });

      popup.remove();
    };

    popup.appendChild(btn);
  });

  const chatContainer = document.querySelector(".chat-app");
  chatContainer.appendChild(popup);

  const buttonRect = button.getBoundingClientRect();
  const containerRect = chatContainer.getBoundingClientRect();

  // Compute dimensions safely after appending
  const popupWidth = popup.offsetWidth || 140;
  const popupHeight = popup.offsetHeight || 40;

  const top = buttonRect.top - containerRect.top - popupHeight - 8;

  let left = buttonRect.left - containerRect.left + (buttonRect.width / 2) - (popupWidth / 2);

  // Clamp left to prevent popup overflow
  if (left < 8) left = 8;
  const maxLeft = containerRect.width - popupWidth - 8;
  if (left > maxLeft) left = maxLeft;

  popup.style.position = "absolute";
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

/**
 * Auto-dismiss the popup when clicking anywhere outside.
 */
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

  // Re-render all reactions
  box.innerHTML = Object.entries(box.dataset)
    .map(([user, emoji]) => `<span class="reaction-tag" title="@${user}">${emoji}</span>`)
    .join(" ");
}
