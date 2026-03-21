#!/usr/bin/env python3
"""
Run from /workspaces/vibron/public:
  python3 fix_host_transfer_ui.py
"""

with open('normal.js', 'r') as f:
    js = f.read()

fixes = 0

# ── Fix 1: host-transferred handler — full replacement ──────────────
OLD_HANDLER = '''socket.on("host-transferred", ({ newHostId }) => {
  Object.keys(participants).forEach(pid => {
    participants[pid].isHost = false;
  });
  if (participants[newHostId]) {
    participants[newHostId].isHost = true;
  }

  if (socket.id === newHostId) {
    isHost = true;
    participants[socket.id] = participants[socket.id] || {};
    participants[socket.id].isHost = true;

    showNotification("🎉 You are now the host");
    showSessionControls(currentSessionCode);
    setSessionControlsDisabled(false);

  } else {
    isHost = false;
    participants[socket.id] = participants[socket.id] || {};
    participants[socket.id].isHost = false;

    showNotification("Host transferred to another user");
    hideSessionControls();
    setSessionControlsDisabled(true);
  }

  renderParticipants();
});'''

NEW_HANDLER = '''socket.on("host-transferred", ({ newHostId }) => {
  // Update all participants isHost flags
  Object.keys(participants).forEach(pid => { participants[pid].isHost = false; });
  if (participants[newHostId]) participants[newHostId].isHost = true;

  const transferBtn  = document.getElementById('transfer-host-btn');
  const sugBtn       = document.getElementById('suggestions-btn');
  const sugBadge     = document.getElementById('suggestions-badge');

  if (socket.id === newHostId) {
    // ── I am the NEW HOST ──
    isHost = true;
    if (participants[socket.id]) participants[socket.id].isHost = true;

    // Body class
    document.body.classList.remove('nonhost-session');

    // Unlock player bar
    showSessionControls(currentSessionCode);
    setSessionControlsDisabled(false);

    // Show host-only buttons
    if (transferBtn) { transferBtn.classList.remove('hidden'); transferBtn.disabled = false; }
    if (sugBtn)      sugBtn.classList.remove('hidden');

    // Re-wire playback buttons (setSessionControlsDisabled may have set onclick=null)
    const playPauseBtn = document.getElementById('play-pause-btn');
    const nextBtn      = document.getElementById('next-btn');
    const prevBtn      = document.getElementById('prev-btn');
    const loopBtn      = document.getElementById('loop-btn');
    const favBtn       = document.getElementById('fav-btn');
    if (playPauseBtn) { playPauseBtn.disabled = false; playPauseBtn.onclick = playPause; }
    if (nextBtn)      { nextBtn.disabled = false;      nextBtn.onclick = () => playNext(); }
    if (prevBtn)      { prevBtn.disabled = false;      prevBtn.onclick = playPrevious; }
    if (loopBtn)      { loopBtn.disabled = false;      loopBtn.onclick = toggleLoop; }
    if (favBtn)       { favBtn.disabled = false;       favBtn.onclick = addToFavoritesFromPlayer; }

    showNotification("🎉 You are now the host!");

  } else {
    // ── I am NO LONGER HOST ──
    isHost = false;
    if (participants[socket.id]) participants[socket.id].isHost = false;

    // Body class — dims player controls
    document.body.classList.add('nonhost-session');

    // Lock player bar
    hideSessionControls();
    setSessionControlsDisabled(true);

    // Hide host-only buttons
    if (transferBtn) { transferBtn.classList.add('hidden'); transferBtn.disabled = true; }
    if (sugBtn)      sugBtn.classList.add('hidden');

    // Clear suggestions
    if (sugBadge) { sugBadge.textContent = '0'; sugBadge.classList.add('hidden'); }
    if (typeof _suggestions !== 'undefined') _suggestions = [];
    const sugPanel = document.getElementById('suggestions-panel');
    if (sugPanel) sugPanel.classList.remove('open');

    showNotification("👑 Host transferred to another user");
  }

  renderParticipants();
});'''

if OLD_HANDLER in js:
    js = js.replace(OLD_HANDLER, NEW_HANDLER)
    fixes += 1
    print("✅ Fix 1: host-transferred handler fully replaced")
else:
    print("⚠️  Fix 1: old handler pattern not found — may already be updated")

# ── Fix 2: showSessionControls — add transfer + suggestions btn show ──
OLD_SHOW = '''function showSessionControls(sessionCode) {
  const controlsBar = document.getElementById('player-controls');
  if (controlsBar) controlsBar.classList.remove('hidden');

  const codeDisplay = document.getElementById('session-code-display');
  if (codeDisplay) codeDisplay.classList.remove('hidden');

  // Just re-enable the buttons — their click handlers are already wired
  // in init via addEventListener. Never override onclick here or it breaks
  // non-session playback permanently.
  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn, #loop-btn, #fav-btn')
    .forEach(btn => { if (btn) btn.disabled = false; });
}'''

NEW_SHOW = '''function showSessionControls(sessionCode) {
  const controlsBar = document.getElementById('player-controls');
  if (controlsBar) controlsBar.classList.remove('hidden');

  const codeDisplay = document.getElementById('session-code-display');
  if (codeDisplay) codeDisplay.classList.remove('hidden');

  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn, #loop-btn, #fav-btn')
    .forEach(btn => { if (btn) btn.disabled = false; });

  // Remove non-host dimming
  document.body.classList.remove('nonhost-session');
}'''

if OLD_SHOW in js:
    js = js.replace(OLD_SHOW, NEW_SHOW)
    fixes += 1
    print("✅ Fix 2: showSessionControls — removes nonhost-session class")
else:
    print("⚠️  Fix 2: showSessionControls pattern not found")

# ── Fix 3: hideSessionControls — add suggestions btn hide + body class ──
OLD_HIDE = '''// Hide session controls for non-hosts
function hideSessionControls() {
  const controlsBar = document.getElementById('player-controls');
  if (controlsBar) controlsBar.classList.add('hidden');

  const transferBtn = document.getElementById('transfer-host-btn');
  if (transferBtn) {
    transferBtn.classList.add('hidden');
    transferBtn.disabled = true;
    transferBtn.onclick = null;
  }

  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn, #loop-btn, #fav-btn')
    .forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.onclick = null;
      }
    });
}'''

NEW_HIDE = '''// Hide session controls for non-hosts
function hideSessionControls() {
  const controlsBar = document.getElementById('player-controls');
  if (controlsBar) controlsBar.classList.add('hidden');

  const transferBtn = document.getElementById('transfer-host-btn');
  if (transferBtn) { transferBtn.classList.add('hidden'); transferBtn.disabled = true; }

  // Hide suggestions button too
  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.add('hidden');

  // Add nonhost-session class to dim player bar
  document.body.classList.add('nonhost-session');

  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn, #loop-btn, #fav-btn')
    .forEach(btn => { if (btn) { btn.disabled = true; btn.onclick = null; } });
}'''

if OLD_HIDE in js:
    js = js.replace(OLD_HIDE, NEW_HIDE)
    fixes += 1
    print("✅ Fix 3: hideSessionControls — hides sugBtn, adds nonhost-session class")
else:
    print("⚠️  Fix 3: hideSessionControls pattern not found")

with open('normal.js', 'w') as f:
    f.write(js)

print(f"\n✅ {fixes}/3 fixes applied to normal.js")
print("Commit and push to deploy.")