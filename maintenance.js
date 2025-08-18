/*
 * Manage maintenance requests.  Records include a date, description
 * and priority.  Users can add new requests and remove them once
 * resolved.  This script interacts with localStorage via common.js.
 */

ensureLoggedIn();

const MAINT_KEY = 'maintenanceRequests';

function renderMaintenance() {
  const list = getItems(MAINT_KEY);
  const ul = document.getElementById('maintenance-list');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `${item.date}: ${item.description} (Priority: ${item.priority})`;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.addEventListener('click', () => {
      deleteItem(MAINT_KEY, index);
      renderMaintenance();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

const form = document.getElementById('maintenance-form');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const newItem = {
      date: document.getElementById('maintenance-date').value,
      description: document.getElementById('maintenance-desc').value.trim(),
      priority: document.getElementById('maintenance-priority').value
    };
    saveItem(MAINT_KEY, newItem);
    form.reset();
    renderMaintenance();
  });
}

renderMaintenance();