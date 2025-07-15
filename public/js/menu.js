let myUsername = null;

export function setMyUsername(username) {
  myUsername = username;
}

// === Get Chat Area ===
function getChatArea() {
  return document.querySelector(".chat-area");
}

// === Close All Popups ===
function closeAllPopups() {
  getChatArea()
    .querySelectorAll(".menu-popup, .submenu-center-popup, .menu-overlay")
    .forEach(el => el.remove());
}

// === Show Toast ===
function showToast(message, options = {}) {
  const chatArea = getChatArea();
  chatArea.querySelectorAll(".undo-toast").forEach(t => t.remove());

  const toast = document.createElement("div");
  toast.className = "undo-toast";
  toast.innerHTML = `
    <span>${message}</span>
    ${options.showUndo ? '<button class="undo-btn">Undo</button>' : ''}
    <button class="toast-close">×</button>
  `;

  chatArea.appendChild(toast);

  // Close button
  toast.querySelector(".toast-close").onclick = () => toast.remove();

  // Undo logic
  if (options.showUndo && typeof options.onUndo === "function") {
    toast.querySelector(".undo-btn").onclick = () => {
      options.onUndo();
      toast.remove();
    };
  }

  // Adjust left position inside chat-area only
  requestAnimationFrame(() => {
    const areaRect = chatArea.getBoundingClientRect();
    const toastRect = toast.getBoundingClientRect();

    const left = areaRect.width / 2 - toastRect.width / 2;
    toast.style.left = `${Math.max(8, Math.min(areaRect.width - toastRect.width - 8, left))}px`;

    // Responsive vertical positioning
    if (window.innerWidth <= 768) {
      toast.style.top = `16px`;
      toast.style.bottom = `auto`;
    } else {
      toast.style.bottom = `clamp(16px, 4vw, 32px)`;
      toast.style.top = `auto`;
    }
  });

  setTimeout(() => toast.remove(), 4000);
}


// === Fallback Clipboard Support ===
function copyTextToClipboard(text) {
  if (!text) return;
  try {
    navigator.clipboard.writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => fallbackCopy(text));
  } catch (err) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    showToast("Copied");
  } catch (err) {
    showToast("Failed to copy");
  }
  document.body.removeChild(textarea);
}

// === Is Within 1 Day ===
function isMessageWithin1Day(timestamp) {
  const sentTime = new Date(timestamp).getTime();
  return Date.now() - sentTime <= 86400000;
}

// === Get Menu Options ===
function getMenuOptions(msg) {
  const { from, to, message, timestamp, id, type } = msg;
  const isSender = from === myUsername;

  const options = [
    {
      label: "Reply",
      icon: "fa-reply",
      action: () => console.log("Reply to", id)
    },
    {
      label: "Forward",
      icon: "fa-share",
      action: () => console.log("Forward", id)
    },
    {
      label: "Copy",
      icon: "fa-copy",
      action: () => {
        if (type === "text" && message) copyTextToClipboard(message);
      }
    },
    {
      label: "Delete",
      icon: "fa-trash-can",
      action: () => {
        closeAllPopups();
        requestAnimationFrame(() => showDeleteSubmenu(msg));
      }
    }
  ];

  if (isSender) {
    options.push({
      label: "Edit",
      icon: "fa-pen-to-square",
      action: () => startInlineEdit(msg)

    });
  }

  return options;
}

// === Show Menu Popup ===
export function showMenuPopup(event, msg) {
  closeAllPopups();
  const chatArea = getChatArea();

  const menu = document.createElement("div");
  menu.className = "menu-popup";

  const options = getMenuOptions(msg);
  for (const option of options) {
    const btn = document.createElement("button");
    btn.innerHTML = `<i class="fa-solid ${option.icon}"></i> ${option.label}`;
    btn.onclick = () => {
      option.action?.();
      closeAllPopups();
    };
    menu.appendChild(btn);
  }

  chatArea.appendChild(menu);

  // Position menu inside chat-area safely
  requestAnimationFrame(() => {
    const clickX = event.clientX;
    const clickY = event.clientY;
    positionMenuSafely(menu, clickX, clickY);
    menu.classList.add("show");
  });

  // Close on outside click
  setTimeout(() => {
    const handler = e => {
      if (!menu.contains(e.target)) {
        closeAllPopups();
        document.removeEventListener("click", handler);
      }
    };
    document.addEventListener("click", handler);
  }, 0);
}

// === Safe Menu Positioning ===
function positionMenuSafely(menu, x, y) {
  const area = getChatArea();
  const areaRect = area.getBoundingClientRect();
  const pad = 8;

  let left = x - areaRect.left;
  let top = y - areaRect.top + 6;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  // Ensure the menu doesn't overflow the chat area
  const rect = menu.getBoundingClientRect();
  const overflowRight = rect.right - areaRect.right;
  const overflowBottom = rect.bottom - areaRect.bottom;

  if (overflowRight > -pad) {
    menu.style.left = `${Math.max(pad, left - overflowRight - pad)}px`;
  }
  if (overflowBottom > -pad) {
    menu.style.top = `${Math.max(pad, top - overflowBottom - pad)}px`;
  }
}

// === Show Delete Submenu ===
function showDeleteSubmenu(msg) {
  const chatArea = getChatArea();

  // Overlay
  const overlay = document.createElement("div");
  overlay.className = "menu-overlay";
  overlay.onclick = closeAllPopups;
  chatArea.appendChild(overlay);

  // Submenu
  const popup = document.createElement("div");
  popup.className = "submenu-center-popup";

  const isSender = msg.from === myUsername;
  const peer = isSender ? msg.to : msg.from;

  const addBtn = (label, className, icon, handler) => {
    const btn = document.createElement("button");
    btn.className = className;
    btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${label}`;
    btn.onclick = () => {
      handler?.();
      closeAllPopups();
    };
    popup.appendChild(btn);
  };

  // Delete for Me
  addBtn("Delete for Me", "delete-btn", "fa-user", () => {
    fetch(`/history/${peer}/${msg.id}/for-me`, {
      method: "DELETE",
      credentials: "include"
    }).then(res => {
      if (res.ok) {
        const el = document.querySelector(`.message[data-id="${msg.id}"]`)?.closest(".message-wrapper");
        if (el) {
          el.classList.add("removing");
          setTimeout(() => el.remove(), 200);
        }
        showToast("Deleted for you", {
          showUndo: true,
          onUndo: () => {
            fetch(`/history/${peer}/${msg.id}/undo-for-me`, {
              method: "POST",
              credentials: "include"
            }).then(() => window.selectChat?.(peer));
          }
        });
      }
    });
  });

  // Delete for Both (only sender & within 1 day)
  if (isSender && isMessageWithin1Day(msg.timestamp)) {
    addBtn("Delete for Both", "delete-btn", "fa-users", () => {
      fetch(`/history/${peer}/${msg.id}/for-both`, {
        method: "DELETE",
        credentials: "include"
      }).then(res => {
        if (res.ok) {
          const el = document.querySelector(`.message[data-id="${msg.id}"]`)?.closest(".message-wrapper");
          if (el) {
            el.classList.add("removing");
            setTimeout(() => el.remove(), 200);
          }
          showToast("Deleted for everyone", {
            showUndo: true,
            onUndo: () => {
              fetch(`/history/${peer}/${msg.id}/undo-for-both`, {
                method: "POST",
                credentials: "include"
              }).then(() => window.selectChat?.(peer));
            }
          });
        }
      });
    });
  }

  // Cancel
  addBtn("Cancel", "cancel-btn", "fa-xmark", () => closeAllPopups());

  chatArea.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("show"));
}
