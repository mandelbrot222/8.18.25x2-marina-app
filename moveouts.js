/*
 * Manage move-out records.  Each entry includes the occupant name,
 * the date of the move-out and optional notes.  Users can add
 * and delete records using this script.
 */

ensureLoggedIn();

const MOVE_KEY = 'moveouts';

function renderMoveouts() {
  const list = getItems(MOVE_KEY);
  const ul = document.getElementById('moveouts-list');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    let text = `${item.date}: ${item.name}`;
    if (item.notes) {
      text += ` – ${item.notes}`;
    }
    li.textContent = text;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.addEventListener('click', () => {
      deleteItem(MOVE_KEY, index);
      renderMoveouts();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

const form = document.getElementById('moveout-form');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const newItem = {
      name: document.getElementById('moveout-name').value.trim(),
      date: document.getElementById('moveout-date').value,
      notes: document.getElementById('moveout-notes').value.trim()
    };
    saveItem(MOVE_KEY, newItem);
    form.reset();
    renderMoveouts();
  });
}

renderMoveouts();