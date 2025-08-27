/*
 * Shared functions for the company portal. These routines handle
 * authentication and basic localStorage operations. Keeping common
 * logic here avoids duplication across multiple pages.
 */

// Default user list.  For a real application you should connect to
// a server or database; here we seed a single admin user to get you
// started.  Modify or extend this array to add additional employees.
const defaultUsers = [
  { username: 'admin', password: 'password' },
  { username: 'Tony Piggot', password: 'Marina1' },
  { username: 'Karli Rich', password: 'Marina1' },
  { username: 'Bri Ghallager', password: 'Marina1' },
  { username: 'Marvin Stohs', password: 'Marina1' },
  { username: 'Mitchel French', password: 'Marina1' },
  { username: 'Leanne Layton', password: 'Marina1' }
];

/**
 * Load the user list from localStorage, seeding defaults if none
 * exist.  Returns an array of user objects.
 */
function loadUsers() {
  let users = JSON.parse(localStorage.getItem('users'));
  if (!users) {
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    users = defaultUsers;
  }
  return users;
}

/**
 * Perform a simple username/password check against the stored user list.
 * On success, marks the session as logged in and navigates to the menu.
 * On failure, displays an error message.
 */
function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const users = loadUsers();
  const found = users.find(u => u.username === username && u.password === password);
  if (found) {
    localStorage.setItem('loggedIn', 'true');
    window.location.href = 'menu.html';
  } else {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
      errorEl.textContent = 'Invalid username or password.';
    }
  }
}

/**
 * Redirect back to the login page if the user is not logged in.
 * You should call this at the top of each protected page.
 */
function ensureLoggedIn() {
  if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'index.html';
  }
}

/**
 * Clear the login flag and return to the landing page.
 */
function logout() {
  localStorage.removeItem('loggedIn');
  window.location.href = 'index.html';
}

/**
 * Read an array of records from localStorage, keyed by `name`.  If
 * nothing is stored yet an empty array is returned.
 *
 * @param {string} name The storage key
 * @returns {Array} An array of records
 */
function getItems(name) {
  return JSON.parse(localStorage.getItem(name)) || [];
}

/**
 * Add an object to an array stored under `name` in localStorage.  If
 * the collection does not exist it will be created.
 *
 * @param {string} name The storage key
 * @param {Object} item The item to add
 */
function saveItem(name, item) {
  const list = getItems(name);
  list.push(item);
  localStorage.setItem(name, JSON.stringify(list));
}

/**
 * Remove an item at a given index from the array stored under `name`.
 * If the index is out of range, this call does nothing.
 *
 * @param {string} name The storage key
 * @param {number} index The index to remove
 */
function deleteItem(name, index) {
  const list = getItems(name);
  if (index >= 0 && index < list.length) {
    list.splice(index, 1);
    localStorage.setItem(name, JSON.stringify(list));
  }
}
