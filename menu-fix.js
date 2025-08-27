// Menu Fixer: makes menu buttons go to the correct pages and wires Logout.
// This file is included directly by menu.html (defer).

(function () {
  function isLoggedIn() { return !!localStorage.getItem('currentUserId'); }
  function goLogin() { location.replace('login.html?return=menu.html'); }

  // Gate: if someone reaches menu without being logged in, send to login
  if (!isLoggedIn()) { goLogin(); return; }

  // Map button/link text to the correct page (for any legacy links on older menus)
  const routes = [
    { test: /boat|trailer/i, url: 'schedule.html' },
    { test: /employee|staff/i, url: 'employees.html' },
    { test: /maintenance/i, url: 'maintenance.html' },
    { test: /move\s*out/i, url: 'moveouts.html' }
  ];

  function normalize(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function labelFor(el) {
    if (!el) return '';
    const aria = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title')) || '';
    let txt = aria || el.textContent || '';
    if (!txt && el.querySelector) {
      const span = el.querySelector('span, strong, em');
      if (span) txt = span.textContent || '';
    }
    return normalize(txt);
  }

  // Rewrite legacy anchors that still go to index.html or '#'
  document.querySelectorAll('a').forEach(a => {
    const href = (a.getAttribute('href') || '').trim();
    const lbl = labelFor(a).toLowerCase();
    if (/^(#|index\.html(?:[#?].*)?)$/.test(href)) {
      for (const r of routes) {
        if (r.test.test(lbl)) { a.setAttribute('href', r.url); break; }
      }
    }
  });

  // Intercept clicks to route properly and handle Logout
  document.addEventListener('click', function (e) {
    const el = e.target.closest('a,button');
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    const href = tag === 'a' ? (el.getAttribute('href') || '') : '';
    const lbl = labelFor(el).toLowerCase();

    // Logout by id or label
    if (/(^|[^a-z])logout([^a-z]|$)/i.test(lbl) || /logout/i.test(el.id || '')) {
      e.preventDefault();
      try {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('currentUserName');
        localStorage.removeItem('currentUserIsAdmin');
      } catch (e) {}
      goLogin();
      return;
    }

    // If anchor points to index.html or '#', rewrite based on label
    if (tag === 'a' && /^(#|index\.html(?:[#?].*)?)$/.test(href)) {
      for (const r of routes) {
        if (r.test.test(lbl)) {
          e.preventDefault();
          location.assign(r.url);
          return;
        }
      }
    }

    // If it's a <button>, route by label
    if (tag === 'button') {
      for (const r of routes) {
        if (r.test.test(lbl)) {
          e.preventDefault();
          location.assign(r.url);
          return;
        }
      }
    }
  }, true);
})();
