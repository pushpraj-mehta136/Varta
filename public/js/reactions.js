const ALLOWED_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "👎"];

let socket = null;
let myUsername = null;

export function initReactions(io, username) {
  socket = io;
  myUsername = username;
}

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

function showReactionPopup(button, bubble, timestamp, toUser) {
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
  if (!chatContainer) return;

  chatContainer.appendChild(popup);

  const buttonRect = button.getBoundingClientRect();
  const containerRect = chatContainer.getBoundingClientRect();

  const popupWidth = popup.offsetWidth || 140;
  const popupHeight = popup.offsetHeight || 40;

  const top = buttonRect.top - containerRect.top - popupHeight - 8;
  let left = buttonRect.left - containerRect.left + (buttonRect.width / 2) - (popupWidth / 2);

  left = Math.max(8, Math.min(left, containerRect.width - popupWidth - 8));

  popup.style.position = "absolute";
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

document.addEventListener("click", () => {
  document.querySelectorAll(".reaction-popup").forEach(el => el.remove());
  document.querySelectorAll(".reaction-users-popup").forEach(el => el.remove());
});

export function handleReactionUpdate({ timestamp, username, emoji }) {
  const bubble = document.querySelector(`.message[data-timestamp="${timestamp}"]`);
  if (!bubble) {
    console.warn("💬 No bubble found for timestamp:", timestamp);
    return;
  }

  let box = bubble.querySelector(".reaction-box");
  if (!box) {
    box = document.createElement("div");
    box.className = "reaction-box";
    box.style.position = "absolute";
    bubble.appendChild(box);
  }

  if (emoji) {
    box.dataset[username] = emoji;
  } else {
    delete box.dataset[username];
  }

  const emojiMap = {};
  Object.entries(box.dataset).forEach(([user, emoji]) => {
    if (!emojiMap[emoji]) emojiMap[emoji] = [];
    emojiMap[emoji].push(user);
  });

  box.innerHTML = "";
  Object.entries(emojiMap).forEach(([emoji, users]) => {
    const span = document.createElement("span");
    span.className = "reaction-tag";
    span.textContent = emoji;
    span.dataset.emoji = emoji;
    span.dataset.users = users.join(",");

    span.onclick = (e) => {
      e.stopPropagation();
      showReactionUsersPopup(e.currentTarget, emoji, users);
    };

    box.appendChild(span);
  });
}

function showReactionUsersPopup(target, emoji, users) {
  document.querySelectorAll(".reaction-users-popup").forEach(el => el.remove());

  const popup = document.createElement("div");
  popup.className = "reaction-users-popup";
  popup.innerHTML = `
    <div class="emoji">${emoji}</div>
    <ul class="user-list">
      ${users.map(user => `<li>@${user}</li>`).join("")}
    </ul>
  `;

  const chatContainer = document.querySelector(".chat-app");
  if (!chatContainer) return;

  chatContainer.appendChild(popup);

  const rect = target.getBoundingClientRect();
  const containerRect = chatContainer.getBoundingClientRect();

  const popupWidth = 160;
  const popupHeight = users.length * 24 + 30;

  const top = rect.top - containerRect.top - popupHeight - 6;
  let left = rect.left - containerRect.left + rect.width / 2 - popupWidth / 2;

  left = Math.max(8, Math.min(left, containerRect.width - popupWidth - 8));

  popup.style.position = "absolute";
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}
