/* ── Vibron PWA Registration ── */
(function () {

  /* ── Register Service Worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service worker registered:', reg.scope);

          // Check for updates every time the page loads
          reg.update();

          // If a new SW is waiting, prompt user to refresh
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] Service worker registration failed:', err));
    });

    // When SW updates and takes control, reload for fresh version
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  /* ── Update Banner ── */
  function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.style.cssText = `
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: #0f1020;
      border: 1px solid rgba(168,85,247,0.4);
      border-radius: 16px; padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Outfit', sans-serif; font-size: 0.88rem;
      color: #eeeeff; white-space: nowrap;
      animation: fadeUp 0.3s ease;
    `;
    banner.innerHTML = `
      <i class="fa-solid fa-rotate" style="color:#a855f7;"></i>
      <span>New version available</span>
      <button onclick="window.location.reload()" style="
        background: linear-gradient(135deg,#a855f7,#6366f1);
        border: none; color: #fff; border-radius: 20px;
        padding: 6px 16px; font-family: 'Outfit',sans-serif;
        font-weight: 600; font-size: 0.82rem; cursor: pointer;
      ">Update</button>
      <button onclick="this.parentElement.remove()" style="
        background: none; border: none; color: #7070a0;
        cursor: pointer; font-size: 1rem; padding: 0 4px;
      ">✕</button>
    `;
    document.body.appendChild(banner);
  }

  /* ── Install Prompt (shared across all pages) ── */
  let _deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;

    // Show install banner if it exists on the page (only normal.html has it)
    // For other pages, just store the prompt for later
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.style.display = 'flex';
  });

  // Expose globally so any page can trigger install
  window.triggerPWAInstall = async function () {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.style.display = 'none';
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install');
    }
  };

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.style.display = 'none';
    console.log('[PWA] App installed successfully');
  });

})();