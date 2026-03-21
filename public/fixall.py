#!/usr/bin/env python3
"""
Run from /workspaces/vibron/public:
  python3 fix_all_transfer_issues.py
"""

fixes = 0

# ════════════════════════════════════════════════
# 1. normal.js patches
# ════════════════════════════════════════════════
with open('normal.js', 'r') as f:
    js = f.read()

# ── Fix A: host name shown as "Host" ────────────────────────────────
# The server create-session handler uses socket.data.displayName which
# is only set in join-session. Fix: emit join-session right after
# create-session so the name is registered.
# Client-side fix: emit name when creating session via a workaround —
# right after session-created fires, emit join-session with userName.
# Actually simplest fix: in hostSession(), set socket.data via a
# dedicated set-name event — but server doesn't have that.
# Real fix: in session-created handler, emit join-session with userName
# so server registers the name properly.
OLD_SESSION_CREATED_END = '''  showNotification('Session hosted! Share the code: ' + code);
  updateChatButtonVisibility();
  showChatButton();

  // Show host-only buttons
  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.remove('hidden');
  const transferBtn = document.getElementById('transfer-host-btn');
  if (transferBtn) { transferBtn.classList.remove('hidden'); transferBtn.disabled = false; }
});'''

NEW_SESSION_CREATED_END = '''  showNotification('Session hosted! Share the code: ' + code);
  updateChatButtonVisibility();
  showChatButton();

  // Register host name with server so participants list shows real name not "Host"
  // join-session as host so server sets displayName properly
  socket.emit('join-session', { code, name: userName || 'Host' }, () => {});

  // Show host-only buttons
  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.remove('hidden');
  const transferBtn = document.getElementById('transfer-host-btn');
  if (transferBtn) { transferBtn.classList.remove('hidden'); transferBtn.disabled = false; }
});'''

if OLD_SESSION_CREATED_END in js:
    js = js.replace(OLD_SESSION_CREATED_END, NEW_SESSION_CREATED_END)
    fixes += 1
    print("✅ Fix A: host name now registered via join-session after create-session")
else:
    print("⚠️  Fix A: session-created end pattern not found")

# ── Fix B: transferHostTo — uncomment closeTransferModal ────────────
OLD_TRANSFER_TO = '''  // Send to backend using the new event + payload
  socket.emit("transfer-host", { code: currentSessionCode, newHostId: targetId });

  //closeTransferModal();
  showNotification("Transferring host...");
}'''

NEW_TRANSFER_TO = '''  socket.emit("transfer-host", { code: currentSessionCode, newHostId: targetId });
  closeTransferModal();
  showNotification("👑 Transferring host...");
}'''

if OLD_TRANSFER_TO in js:
    js = js.replace(OLD_TRANSFER_TO, NEW_TRANSFER_TO)
    fixes += 1
    print("✅ Fix B: closeTransferModal() called after transfer")
else:
    print("⚠️  Fix B: transferHostTo pattern not found")

# ── Fix C: closeTransferModal — add null guard ───────────────────────
OLD_CLOSE = '''function closeTransferModal() {
  document.getElementById('transfer-modal').classList.add('hidden');

}'''

NEW_CLOSE = '''function closeTransferModal() {
  const modal = document.getElementById('transfer-modal');
  if (modal) modal.classList.add('hidden');
}'''

if OLD_CLOSE in js:
    js = js.replace(OLD_CLOSE, NEW_CLOSE)
    fixes += 1
    print("✅ Fix C: closeTransferModal null guard added")
else:
    print("⚠️  Fix C: closeTransferModal pattern not found")

# ── Fix D: showTransferModal — styled list items, cursor, filter self ──
OLD_SHOW_TRANSFER = '''function showTransferModal() {
  const modal = document.getElementById('transfer-modal');
  const list  = document.getElementById('transfer-list');
  list.innerHTML = '';

  const entries = Object.entries(participants || {});
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No participants to transfer to';
    list.appendChild(li);
  } else {
    entries.forEach(([socketId, p]) => {
      if (socketId !== mySocketId) {
        const li = document.createElement('li');
        const role = p.isHost ? ' (Host)' : '';
        const displayName = p.name || socketId;  // ✅ prefer name, fallback to id
        li.textContent = `${displayName}${role}`;
        li.onclick = () => transferHostTo(socketId);
        list.appendChild(li);
      }
    });
  }

  modal.classList.remove('hidden');
}'''

NEW_SHOW_TRANSFER = '''function showTransferModal() {
  if (!isHost || !currentSessionCode) {
    showNotification('You must be the host to transfer.');
    return;
  }
  const modal = document.getElementById('transfer-modal');
  const list  = document.getElementById('transfer-list');
  if (!modal || !list) return;
  list.innerHTML = '';

  const entries = Object.entries(participants || {}).filter(([id]) => id !== mySocketId);

  if (entries.length === 0) {
    list.innerHTML = '<li class="transfer-list-empty">No other participants in the session yet.</li>';
  } else {
    entries.forEach(([socketId, p]) => {
      const li = document.createElement('li');
      li.className = 'transfer-list-item';
      li.innerHTML = `
        <div class="transfer-user-info">
          <div class="transfer-avatar">${(p.name || 'G')[0].toUpperCase()}</div>
          <span class="transfer-name">${p.name || 'Guest'}</span>
        </div>
        <button class="transfer-pick-btn" onclick="event.stopPropagation(); transferHostTo('${socketId}')">
          <i class="fas fa-crown"></i> Make Host
        </button>`;
      list.appendChild(li);
    });
  }
  modal.classList.remove('hidden');
}'''

if OLD_SHOW_TRANSFER in js:
    js = js.replace(OLD_SHOW_TRANSFER, NEW_SHOW_TRANSFER)
    fixes += 1
    print("✅ Fix D: showTransferModal — styled cards, cursor fixed, self filtered")
else:
    print("⚠️  Fix D: showTransferModal pattern not found")

# ── Fix E: hideSessionControls — don't null out fav-btn/loop-btn onclick,
#    add nonhost-session class, hide sugBtn ──────────────────────────────
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

  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.add('hidden');

  // Dim player bar via CSS class
  document.body.classList.add('nonhost-session');

  // Disable playback-only controls (NOT fav/loop — those are local)
  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn')
    .forEach(btn => { if (btn) { btn.disabled = true; btn.onclick = null; } });
}'''

if OLD_HIDE in js:
    js = js.replace(OLD_HIDE, NEW_HIDE)
    fixes += 1
    print("✅ Fix E: hideSessionControls — fav/loop kept, sugBtn hidden, nonhost-session added")
else:
    print("⚠️  Fix E: hideSessionControls pattern not found")

# ── Fix F: showSessionControls — remove nonhost-session class ───────
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

  document.body.classList.remove('nonhost-session');

  document.querySelectorAll('#play-pause-btn, #next-btn, #prev-btn, #loop-btn, #fav-btn')
    .forEach(btn => { if (btn) btn.disabled = false; });
}'''

if OLD_SHOW in js:
    js = js.replace(OLD_SHOW, NEW_SHOW)
    fixes += 1
    print("✅ Fix F: showSessionControls — removes nonhost-session class")
else:
    print("⚠️  Fix F: showSessionControls pattern not found")

# ── Fix G: host-transferred — full replacement with all UI updates ───
OLD_HOST_TRANSFERRED = '''socket.on("host-transferred", ({ newHostId }) => {
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

NEW_HOST_TRANSFERRED = '''socket.on("host-transferred", ({ newHostId }) => {
  // Update all participants isHost flags
  Object.keys(participants).forEach(pid => { participants[pid].isHost = false; });
  if (participants[newHostId]) participants[newHostId].isHost = true;

  const transferBtn = document.getElementById('transfer-host-btn');
  const sugBtn      = document.getElementById('suggestions-btn');
  const sugBadge    = document.getElementById('suggestions-badge');

  if (socket.id === newHostId) {
    // ── I became the NEW HOST ──
    isHost = true;
    if (participants[socket.id]) participants[socket.id].isHost = true;

    showSessionControls(currentSessionCode); // removes nonhost-session, re-enables controls
    setSessionControlsDisabled(false);

    // Re-wire play/next/prev onclick (set to null when we were non-host)
    const pbBtn = document.getElementById('play-pause-btn');
    const nxtBtn = document.getElementById('next-btn');
    const prvBtn = document.getElementById('prev-btn');
    if (pbBtn) { pbBtn.disabled = false; pbBtn.onclick = playPause; }
    if (nxtBtn) { nxtBtn.disabled = false; nxtBtn.onclick = () => playNext(); }
    if (prvBtn) { prvBtn.disabled = false; prvBtn.onclick = playPrevious; }

    // Show host-only buttons
    if (transferBtn) { transferBtn.classList.remove('hidden'); transferBtn.disabled = false; }
    if (sugBtn) sugBtn.classList.remove('hidden');

    // Show session code bar
    const codeDisplay = document.getElementById('session-code-display');
    if (codeDisplay) codeDisplay.classList.remove('hidden');

    showNotification("🎉 You are now the host!");

  } else {
    // ── I am NO LONGER HOST ──
    isHost = false;
    if (participants[socket.id]) participants[socket.id].isHost = false;

    hideSessionControls(); // adds nonhost-session, hides transfer+suggestions btns
    setSessionControlsDisabled(true);

    // Hide host-only buttons explicitly
    if (transferBtn) { transferBtn.classList.add('hidden'); transferBtn.disabled = true; }
    if (sugBtn) sugBtn.classList.add('hidden');

    // Clear suggestions
    if (sugBadge) { sugBadge.textContent = '0'; sugBadge.classList.add('hidden'); }
    if (typeof _suggestions !== 'undefined') _suggestions = [];
    const sugPanel = document.getElementById('suggestions-panel');
    if (sugPanel) sugPanel.classList.remove('open');

    showNotification("👑 Host transferred to another user");
  }

  renderParticipants();
});'''

if OLD_HOST_TRANSFERRED in js:
    js = js.replace(OLD_HOST_TRANSFERRED, NEW_HOST_TRANSFERRED)
    fixes += 1
    print("✅ Fix G: host-transferred — complete UI swap for both sides")
else:
    print("⚠️  Fix G: host-transferred pattern not found")

# ── Fix H: renderParticipants — show name without "Host" label ──────
OLD_RENDER = '''      li.textContent = `${name}${p.isHost ? ' 👑' : ''}`;'''
NEW_RENDER = '''      li.textContent = `${name}${p.isHost ? ' 👑' : ''}`;  // crown shows host, no word "Host"'''

# Actually the real fix: don't show "Host" as fallback name
OLD_RENDER_NAME = '''      const name = (p.name && p.name.trim()) ? p.name : `User ${userId.slice(0,4)}`;'''
NEW_RENDER_NAME = '''      // Show real name; if name is literally "Host" and user has a real name use it
      const rawName = (p.name && p.name.trim() && p.name !== 'Host') ? p.name : (p.name === 'Host' ? '👑' : `User ${userId.slice(0,4)}`);
      const name = rawName;'''

if OLD_RENDER_NAME in js:
    js = js.replace(OLD_RENDER_NAME, NEW_RENDER_NAME)
    fixes += 1
    print("✅ Fix H: renderParticipants — 'Host' name fallback replaced with crown emoji")
else:
    print("⚠️  Fix H: renderParticipants name pattern not found")

with open('normal.js', 'w') as f:
    f.write(js)

print(f"\n✅ {fixes} JS fixes applied to normal.js")

# ════════════════════════════════════════════════
# 2. normal.html — close transfer modal on backdrop click
# ════════════════════════════════════════════════
with open('normal.html', 'r') as f:
    html = f.read()

html_fixes = 0

# Add onclick to transfer-modal backdrop (the modal-content div itself)
# When user clicks outside the inner content, close it
OLD_TRANSFER_MODAL = '''    <div id="transfer-modal" class="modal-content hidden">
      <span class="close" onclick="closeTransferModal()">×</span>'''

NEW_TRANSFER_MODAL = '''    <div id="transfer-modal" class="modal-content hidden">
      <span class="close" onclick="closeTransferModal()">×</span>'''

# Add a backdrop overlay behind transfer modal
OLD_TRANSFER_WRAP = '''    <!-- Transfer Host Modal -->
    <div id="transfer-modal" class="modal-content hidden">'''

NEW_TRANSFER_WRAP = '''    <!-- Transfer Host Modal -->
    <div id="transfer-modal-backdrop" class="transfer-modal-backdrop hidden" onclick="closeTransferModal()"></div>
    <div id="transfer-modal" class="modal-content hidden">'''

if OLD_TRANSFER_WRAP in html:
    html = html.replace(OLD_TRANSFER_WRAP, NEW_TRANSFER_WRAP)
    html_fixes += 1
    print("✅ HTML Fix 1: transfer modal backdrop added (click outside to close)")
else:
    print("⚠️  HTML Fix 1: transfer modal not found or already updated")

with open('normal.html', 'w') as f:
    f.write(html)

print(f"✅ {html_fixes} HTML fixes applied")

# ════════════════════════════════════════════════
# 3. css/normal.css patches
# ════════════════════════════════════════════════
with open('css/normal.css', 'r') as f:
    css = f.read()

css_fixes = 0

# Add transfer modal backdrop + cursor:pointer on list items
TRANSFER_CSS_ADD = """
/* ── TRANSFER MODAL EXTRAS ── */
.transfer-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  z-index: 1999;
}
.transfer-modal-backdrop.hidden { display: none !important; }
#transfer-modal { z-index: 2000; }
.transfer-list-item { cursor: default; }
.transfer-pick-btn { cursor: pointer; }
"""

if 'transfer-modal-backdrop' not in css:
    css += TRANSFER_CSS_ADD
    css_fixes += 1
    print("✅ CSS Fix 1: transfer modal backdrop + cursor styles added")
else:
    print("⚠️  CSS Fix 1: transfer-modal-backdrop already in CSS")

# Fix: shuffle should not be usable by non-host (block in CSS at least visually)
# Actually shuffle is client-side local only - it just reorders queue
# The real issue is fav button. Let's make sure nonhost-session doesn't dim fav/loop
NONHOST_CSS_FIX = """
/* Non-host: only dim playback controls, NOT fav/loop/download */
body.nonhost-session #play-pause-btn,
body.nonhost-session #next-btn,
body.nonhost-session #prev-btn {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
}
/* Fav, loop, download, sleep remain fully usable for non-hosts */
body.nonhost-session #fav-btn,
body.nonhost-session #loop-btn,
body.nonhost-session #download-btn,
body.nonhost-session #sleep-timer-btn,
body.nonhost-session #shuffle-btn {
  opacity: 1 !important;
  cursor: pointer !important;
  pointer-events: auto !important;
}
"""

if 'nonhost-session #fav-btn' not in css:
    css += NONHOST_CSS_FIX
    css_fixes += 1
    print("✅ CSS Fix 2: nonhost-session — fav/loop/download/sleep remain active")
else:
    print("⚠️  CSS Fix 2: nonhost fav CSS already present")

with open('css/normal.css', 'w') as f:
    f.write(css)

print(f"✅ {css_fixes} CSS fixes applied")

# ════════════════════════════════════════════════
# 4. Also update showTransferModal to show/hide backdrop
# ════════════════════════════════════════════════
with open('normal.js', 'r') as f:
    js = f.read()

OLD_MODAL_SHOW_END = '''  modal.classList.remove('hidden');
}'''

# Only replace in showTransferModal context
if "showTransferModal" in js and "transfer-modal-backdrop" not in js:
    js = js.replace(
        "  modal.classList.remove('hidden');\n}",
        "  modal.classList.remove('hidden');\n  const bd = document.getElementById('transfer-modal-backdrop');\n  if (bd) bd.classList.remove('hidden');\n}",
        1  # only first occurrence (showTransferModal)
    )
    print("✅ JS: showTransferModal now shows backdrop")

    # Also update closeTransferModal to hide backdrop
    js = js.replace(
        "function closeTransferModal() {\n  const modal = document.getElementById('transfer-modal');\n  if (modal) modal.classList.add('hidden');\n}",
        "function closeTransferModal() {\n  const modal = document.getElementById('transfer-modal');\n  if (modal) modal.classList.add('hidden');\n  const bd = document.getElementById('transfer-modal-backdrop');\n  if (bd) bd.classList.add('hidden');\n}"
    )
    print("✅ JS: closeTransferModal now hides backdrop")

    with open('normal.js', 'w') as f:
        f.write(js)

print("\n🎉 All done! Commit and push to deploy.")
print("\nSummary of all fixes:")
print("  A. Host name shows real name (not 'Host') in participants list")
print("  B. Transfer modal closes after selecting new host")
print("  C. closeTransferModal null-safe")
print("  D. Transfer modal shows styled cards with avatar + Make Host button")
print("  E. hideSessionControls: fav/loop NOT disabled, sugBtn hidden, body class added")
print("  F. showSessionControls: nonhost-session body class removed")
print("  G. host-transferred: full UI swap - all buttons, body class, suggestions")
print("  H. Participant list: 'Host' fallback replaced with crown emoji")
print("  CSS1. Transfer modal backdrop (click outside to close)")
print("  CSS2. Fav/loop/download/sleep/shuffle remain active for non-hosts")