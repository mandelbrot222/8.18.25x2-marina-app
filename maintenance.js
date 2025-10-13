/*
 * Maintenance Requests management
 * - Displays open and recently completed requests
 * - Allows creating new requests via modal
 * - Clicking an open request shows details and option to mark complete
 */

ensureLoggedIn();

const OPEN_KEY = 'maintenanceOpenRequests';
const CLOSED_KEY = 'maintenanceClosedRequests';

let EMPLOYEES = [];
let currentIndex = null; // index of request currently viewed

function getOpenList() {
  return getItems(OPEN_KEY);
}
function setOpenList(list) {
  localStorage.setItem(OPEN_KEY, JSON.stringify(list));
}
function getClosedList() {
  return getItems(CLOSED_KEY);
}
function setClosedList(list) {
  localStorage.setItem(CLOSED_KEY, JSON.stringify(list));
}

async function loadEmployees() {
  try {
    const res = await fetch('data/employees.json', { cache: 'no-store' });
    if (res.ok) {
      EMPLOYEES = await res.json();
    }
  } catch (e) {
    console.warn('Employee list load failed', e);
  }
}

function populateEmployeeDropdown() {
  const sel = document.getElementById('req-employee');
  if (!sel) return;
  sel.innerHTML = '<option value="" disabled selected>Select employee</option>';
  EMPLOYEES.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.name;
    opt.textContent = emp.name;
    sel.appendChild(opt);
  });
}

function renderOpen() {
  const ul = document.getElementById('open-list');
  const list = getOpenList();
  if (!ul) return;
  ul.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'req-number';
    num.textContent = `${i + 1}.`;
    li.appendChild(num);

    const text = document.createElement('span');
    text.className = 'req-text';
    const item = list[i];
    if (item) {
      text.textContent = `${formatDate(item.date)} - ${item.description} (${item.priority})`;
      li.addEventListener('click', () => openDetail(i));
      li.classList.add('clickable');
    }
    li.appendChild(text);
    ul.appendChild(li);
  }
}

function renderClosed() {
  const ul = document.getElementById('closed-list');
  const list = getClosedList();
  if (!ul) return;
  ul.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'req-number';
    num.textContent = `${i + 1}.`;
    li.appendChild(num);

    const text = document.createElement('span');
    text.className = 'req-text';
    const item = list[i];
    if (item) {
      text.textContent = `${formatDate(item.date)} - ${item.description} (${item.priority})`;
    }
    li.appendChild(text);
    ul.appendChild(li);
  }
}

function openRequestModal() {
  const modal = document.getElementById('request-modal');
  if (modal) modal.style.display = 'flex';
}
function closeRequestModal() {
  const modal = document.getElementById('request-modal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('request-form');
  if (form) form.reset();
}

function openDetail(index) {
  const list = getOpenList();
  const item = list[index];
  if (!item) return;
  currentIndex = index;
  const container = document.getElementById('detail-content');
  if (container) {
    container.innerHTML = `
      <p><strong>Employee:</strong> ${item.employee}</p>
      ${item.customer ? `<p><strong>Customer:</strong> ${item.customer}</p>` : ''}
      ${item.phone ? `<p><strong>Phone:</strong> ${item.phone}</p>` : ''}
      <p><strong>Date:</strong> ${item.date}</p>
      <p><strong>Description:</strong> ${item.description}</p>
      <p><strong>Priority:</strong> ${item.priority}</p>
      <p><strong>Location:</strong> ${item.location}</p>
    `;
  }
  const modal = document.getElementById('detail-modal');
  if (modal) modal.style.display = 'flex';
}
function closeDetail() {
  const modal = document.getElementById('detail-modal');
  if (modal) modal.style.display = 'none';
  currentIndex = null;
}

function completeCurrent() {
  if (currentIndex == null) return;
  const openList = getOpenList();
  const item = openList.splice(currentIndex, 1)[0];
  setOpenList(openList);
  const closed = getClosedList();
  closed.unshift(item);
  if (closed.length > 20) closed.length = 20;
  setClosedList(closed);
  closeDetail();
  renderOpen();
  renderClosed();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadEmployees();
  populateEmployeeDropdown();
  renderOpen();
  renderClosed();

  const newBtn = document.getElementById('btn-new-request');
  if (newBtn) newBtn.addEventListener('click', openRequestModal);

  const cancelBtn = document.getElementById('req-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeRequestModal);

  const form = document.getElementById('request-form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const item = {
      employee: document.getElementById('req-employee').value,
      customer: document.getElementById('req-customer').value.trim(),
      phone: document.getElementById('req-phone').value.trim(),
      date: document.getElementById('req-date').value,
      description: document.getElementById('req-desc').value.trim(),
      priority: document.getElementById('req-priority').value,
      location: document.getElementById('req-location').value.trim()
    };
    const list = getOpenList();
    list.push(item);
    setOpenList(list);
    closeRequestModal();
    renderOpen();
  });

  const detailClose = document.getElementById('detail-close');
  if (detailClose) detailClose.addEventListener('click', closeDetail);

  const detailComplete = document.getElementById('detail-complete');
  if (detailComplete) detailComplete.addEventListener('click', completeCurrent);
});

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
