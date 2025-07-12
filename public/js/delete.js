// delete.js

/**
 * Deletes a message only for the current user.
 * Removes it from the UI and informs the server to hide for this user.
 */
export function handleDeleteForMe(messageId) {
  const msgWrapper = document.querySelector(`.message-wrapper[data-id="${messageId}"]`);
  if (!msgWrapper) return;

  fetch('/messages/delete/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messageId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      msgWrapper.remove(); // Completely removes from DOM
    }
  })
  .catch(err => {
    console.error("Error deleting message for me:", err);
  });
}


/**
 * Deletes a message for both sender and receiver.
 * Allowed only for the sender. Message is removed from server history.
 */
export function handleDeleteForBoth(messageId) {
  const msgWrapper = document.querySelector(`.message-wrapper[data-id="${messageId}"]`);
  if (!msgWrapper) return;

  fetch('/messages/delete/both', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messageId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      msgWrapper.remove(); // Remove from DOM on success
    }
  })
  .catch(err => {
    console.error("Error deleting message for both:", err);
  });
}
