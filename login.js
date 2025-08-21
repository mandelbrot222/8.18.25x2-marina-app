// Simple client-side login based on data/employees.json
// - Username: full name (case-insensitive) from the roster
// - Password: "Marina1" for all users (temporary)
// - Admin: only if name === "Haak Wagner" (case-insensitive)
// - Sets localStorage: currentUserId, currentUserName, currentUserIsAdmin

const ROSTER_URL = 'data/employees.json';

async function loadRosterNames() {
  try {
    const res = await fetch(ROSTER_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Roster fetch failed');
    const list = await res.json();
    const dl = document.getElementById('roster');
    dl.innerHTML = '';
    (list || []).forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.name || '';
      dl.appendChild(opt);
    });
    return list || [];
  } catch (e) {
    console.warn('Roster not available:', e);
    return [];
  }
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findEmployeeByName(list, name) {
  const needle = normalizeName(name);
  return list.find(e => normalizeName(e.name) === needle);
}

document.addEventListener('DOMContentLoaded', async () => {
  const employees = await loadRosterNames();

  const form = document.getElementById('login-form');
  const nameEl = document.getElementById('login-name');
  const passEl = document.getElementById('login-pass');
  const msgEl = document.getElementById('login-msg');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msgEl.textContent = '';

    const nameIn = nameEl.value;
    const passIn = passEl.value;

    const emp = findEmployeeByName(employees, nameIn);
    if (!emp) {
      msgEl.textContent = 'Name not found. Please enter your full name as it appears in the roster.';
      nameEl.focus();
      return;
    }
    if (passIn !== 'Marina1') {
      msgEl.textContent = 'Incorrect password.';
      passEl.focus();
      return;
    }

    // Success: set session flags
    localStorage.setItem('currentUserId', String(emp.id));
    localStorage.setItem('currentUserName', String(emp.name));
    const isAdmin = normalizeName(emp.name) === 'haak wagner';
    localStorage.setItem('currentUserIsAdmin', String(isAdmin));

    // Optional: keep roster in localStorage for pages that need it
    try { localStorage.setItem('employees', JSON.stringify(employees)); } catch {}

    // Redirect
    const params = new URLSearchParams(location.search);
    const ret = params.get('return') || 'menu.html';
    location.assign(ret);
  });
});
