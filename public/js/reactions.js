const ALLOWED_REACTIONS = ["❤️", "😂", "👍", "😮", "🙏"];
let socket = null;
let myUsername = null;

export function initReactions(io, username) {
  socket = io;
  myUsername = username;
}

export function addReactionButton(bubble, timeContainer, id, isOutgoing, toUser) {
  const emojiBtn = document.createElement("button");
  emojiBtn.className = "reaction-emoji-button";
  emojiBtn.innerHTML = "<i class='far fa-smile'></i>";
  emojiBtn.title = "React";

  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showReactionPopup(e.currentTarget, bubble, id, toUser);
  });

  let pressTimer = null;
  emojiBtn.addEventListener("touchstart", () => {
    pressTimer = setTimeout(() => showReactionPopup(emojiBtn, bubble, id, toUser), 400);
  });
  emojiBtn.addEventListener("touchend", () => clearTimeout(pressTimer));

  let lastTap = 0;
  bubble.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      triggerDefaultHeartReaction(bubble, id, toUser);
    }
    lastTap = now;
  });

  bubble.addEventListener("dblclick", (e) => {
    e.preventDefault();
    triggerDefaultHeartReaction(bubble, id, toUser);
  });

  isOutgoing
    ? timeContainer.insertBefore(emojiBtn, timeContainer.firstChild)
    : timeContainer.appendChild(emojiBtn);
}

function triggerDefaultHeartReaction(bubble, id, toUser) {
  const box = bubble.parentElement?.querySelector(".reaction-box");
  const reactions = box?.reactions || {};
  const current = reactions[myUsername];
  const newEmoji = current === "❤️" ? null : "❤️";

  socket.emit("react-message", {
    from: myUsername,
    to: toUser,
    id,
    emoji: newEmoji
  });

  if (newEmoji) showFloatingBurst("❤️", bubble);
}

function showReactionPopup(button, bubble, id, toUser) {
  document.querySelectorAll(".reaction-popup").forEach(el => el.remove());

  const popup = document.createElement("div");
  popup.className = "reaction-popup";

  const box = bubble.parentElement?.querySelector(".reaction-box");
  const reactions = box?.reactions || {};
  const current = reactions[myUsername];

  ALLOWED_REACTIONS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.className = "reaction-btn";
    btn.textContent = emoji;
    if (current === emoji) btn.classList.add("selected");

    btn.onclick = (e) => {
      e.stopPropagation();
      const newEmoji = current === emoji ? null : emoji;

      socket.emit("react-message", {
        from: myUsername,
        to: toUser,
        id,
        emoji: newEmoji
      });

      if (newEmoji) showFloatingBurst(emoji, bubble);
      popup.remove();
    };

    popup.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.className = "reaction-btn custom";
  customBtn.innerHTML = "<i class='fas fa-plus'></i>";
  customBtn.title = "Custom Emoji";
  customBtn.onclick = async (e) => {
    e.stopPropagation();
    const userEmoji = await showEmojiInputDialog();
    if (!userEmoji) return;

    socket.emit("react-message", {
      from: myUsername,
      to: toUser,
      id,
      emoji: userEmoji
    });

    showFloatingBurst(userEmoji, bubble);
    popup.remove();
  };
  popup.appendChild(customBtn);

  const container = document.querySelector(".chat-area") || document.body;
  container.appendChild(popup);

  requestAnimationFrame(() => {
    const btnRect = button.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const padding = 8;
    let top = btnRect.top - containerRect.top - popupRect.height - 6;
    let left = btnRect.left - containerRect.left + (btnRect.width - popupRect.width) / 2;

    if (top < padding) {
      top = btnRect.bottom - containerRect.top + 6;
    }
    if (left < padding) {
      left = padding;
    } else if (left + popupRect.width > containerRect.width - padding) {
      left = containerRect.width - popupRect.width - padding;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  });
}

async function showEmojiInputDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "emoji-input-dialog";
    dialog.innerHTML = `
      <div class="emoji-input-container">
        <div class="emoji-input-title">Add Reaction</div>
        <input type="text" class="emoji-input" placeholder="Enter an emoji" maxlength="2">
        <div class="emoji-input-buttons">
          <button class="emoji-input-cancel">Cancel</button>
          <button class="emoji-input-submit" disabled>OK</button>
        </div>
      </div>
    `;

    const input = dialog.querySelector(".emoji-input");
    const cancelBtn = dialog.querySelector(".emoji-input-cancel");
    const submitBtn = dialog.querySelector(".emoji-input-submit");
    const container = dialog.querySelector(".emoji-input-container");

    const cleanup = () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      dialog.remove();
    };

    const handleOutsideClick = (e) => {
      if (!container.contains(e.target)) {
        cleanup();
        resolve(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };

    input.addEventListener("input", (e) => {
      const value = e.target.value;
      const emojiOnly = value.replace(/[^\p{Emoji}]/gu, '');
      const limited = emojiOnly.slice(0, 2);
      e.target.value = limited;
      submitBtn.disabled = limited.length === 0;
    });

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    submitBtn.addEventListener("click", () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    });

    document.body.appendChild(dialog);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    input.focus();
  });
}

export function handleReactionUpdate({ id, username, emoji, reactions }, selfUser) {
  const bubble = document.querySelector(`.message[data-id="${id}"]`);
  if (!bubble) return;

  const wrapper = bubble.parentElement;
  let box = wrapper.querySelector(".reaction-box");
  if (!box) {
    box = document.createElement("div");
    box.className = "reaction-box";
    wrapper.insertBefore(box, wrapper.querySelector(".meta-row"));
  }

  box.reactions = reactions;

  if (!reactions || Object.keys(reactions).length === 0) {
    box.remove();
    return;
  }

  renderReactions(box, reactions);
  if (emoji && username !== selfUser) {
    showFloatingBurst(emoji, bubble);
  }
}

export function renderReactions(box, reactions) {
  if (!box || !reactions) return;

  box.reactions = reactions;
  box.innerHTML = "";

  const emojiMap = {};
  for (const [user, emoji] of Object.entries(reactions)) {
    if (!emoji) continue;
    if (!emojiMap[emoji]) emojiMap[emoji] = [];
    emojiMap[emoji].push(user);
  }

  for (const [emoji, users] of Object.entries(emojiMap)) {
    const span = document.createElement("span");
    span.className = "reaction-tag";
    span.dataset.emoji = emoji;
    span.textContent = users.length > 1 ? `${emoji} ×${users.length}` : emoji;

    span.onclick = (e) => {
      e.stopPropagation();
      showReactionUsersPopup(span, emoji, users);
    };

    box.appendChild(span);
  }
}

function showReactionUsersPopup(target, emoji, users) {
  document.querySelectorAll(".reaction-users-popup").forEach(el => el.remove());

  const popup = document.createElement("div");
  popup.className = "reaction-users-popup";

  const listItems = users.map(username => {
    const avatarUrl = window.avatarMap?.[username];
    const avatar = avatarUrl
      ? `<img class="reaction-user-avatar-img" src="${avatarUrl}" alt="${username}">`
      : `<div class="reaction-user-avatar-initial">${username[0]?.toUpperCase()}</div>`;

    return `
      <li>
        ${avatar}
        <span class="reaction-user-name">@${username}</span>
      </li>
    `;
  }).join("");

  popup.innerHTML = `
    <div class="emoji">${emoji}</div>
    <ul class="user-list">${listItems}</ul>
  `;

  const container = document.querySelector(".chat-area");
  container.appendChild(popup);

  requestAnimationFrame(() => {
    const rect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    let top = rect.top - containerRect.top - 40;
    let left = rect.left - containerRect.left - 80;

    if (top < 8) top = rect.bottom - containerRect.top + 8;
    if (left < 8) left = 8;
    if (left + 220 > containerRect.width) {
      left = containerRect.width - 220;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  });
}

function showFloatingBurst(emoji, bubble) {
  const container = document.querySelector(".chat-area");
  const rect = bubble.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const startX = rect.left - containerRect.left + rect.width / 2;
  const startY = rect.top - containerRect.top + rect.height / 2;

  for (let i = 0; i < 6; i++) {
    const float = document.createElement("div");
    float.className = "reaction-burst";
    float.textContent = emoji;
    const size = 20 + Math.random() * 12;
    const delay = Math.random() * 0.3;

    float.style.left = `${startX}px`;
    float.style.top = `${startY}px`;
    float.style.fontSize = `${size}px`;
    float.style.animation = `burstUp 1s ${delay}s ease-out forwards`;

    container.appendChild(float);
    float.addEventListener("animationend", () => float.remove(), { once: true });
  }
}

// Auto-close popups on click or scroll
document.addEventListener("click", () => {
  document.querySelectorAll(".reaction-popup, .reaction-users-popup").forEach(el => el.remove());
});
document.querySelector(".messages")?.addEventListener("scroll", () => {
  document.querySelectorAll(".reaction-popup").forEach(el => el.remove());
});
