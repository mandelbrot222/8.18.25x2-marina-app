// sw-kill.js — aggressively disable any existing Service Worker + caches for this origin.
(function () {
  async function kill() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) { try { await r.unregister(); } catch (e) {} }
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // Only force one reload when changes were present
      const reloaded = sessionStorage.getItem('swKilledOnce');
      if (!reloaded && (navigator.serviceWorker || window.caches)) {
        sessionStorage.setItem('swKilledOnce', '1');
        // Soft reload to pick up fresh HTML without SW
        location.reload();
      }
    } catch (e) {
      // swallow
    }
  }
  // Run ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kill);
  } else {
    kill();
  }
})();
