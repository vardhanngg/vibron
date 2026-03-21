#!/usr/bin/env python3
"""
Run from /workspaces/vibron/public:
  python3 fix_transfer.py
"""
import re

# ── 1. FIX normal.js ──────────────────────────────────────────────
with open('normal.js', 'r') as f:
    js = f.read()

OLD_JS = """  // Show suggestions button for host
  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.remove('hidden');
});"""

NEW_JS = """  // Show host-only buttons
  const sugBtn = document.getElementById('suggestions-btn');
  if (sugBtn) sugBtn.classList.remove('hidden');
  const transferBtn = document.getElementById('transfer-host-btn');
  if (transferBtn) { transferBtn.classList.remove('hidden'); transferBtn.disabled = false; }
});"""

if OLD_JS in js:
    js = js.replace(OLD_JS, NEW_JS)
    print("✅ JS fix applied: transfer-host-btn shown on session-created")
else:
    print("⚠️  JS pattern not found — checking if already fixed...")
    if 'transfer-host-btn' in js and 'classList.remove' in js:
        print("   Appears already fixed (transfer-host-btn remove hidden exists)")
    else:
        print("   ❌ Could not locate pattern — manual fix needed")

with open('normal.js', 'w') as f:
    f.write(js)

# ── 2. FIX normal.html ───────────────────────────────────────────
with open('normal.html', 'r') as f:
    html = f.read()

# Check if transfer modal already exists
if 'id="transfer-modal"' in html:
    print("✅ HTML: transfer-modal already exists")
else:
    # Add transfer modal before <!-- Home Content -->
    MODAL_HTML = """    <!-- Transfer Host Modal -->
    <div id="transfer-modal" class="modal-content hidden">
      <span class="close" onclick="closeTransferModal()">×</span>
      <h2><i class="fas fa-crown" style="margin-right:8px;color:#ff9500;"></i>Transfer Host</h2>
      <p style="color:var(--muted);font-size:0.88rem;margin:0.5rem 0 1rem;">Choose a listener to become the new host. They will gain full playback control.</p>
      <ul id="transfer-list" class="transfer-list"></ul>
      <div class="modal-buttons" style="margin-top:1rem;">
        <button class="modal-btn cancel-btn" onclick="closeTransferModal()">Cancel</button>
      </div>
    </div>

    <!-- Home Content -->"""
    if '<!-- Home Content -->' in html:
        html = html.replace('    <!-- Home Content -->', MODAL_HTML, 1)
        print("✅ HTML: transfer-modal added")
    else:
        print("❌ HTML: could not find insertion point for transfer-modal")

# Move transfer-host-btn into session-code-actions if it's standalone
if 'class="listen-btn hidden" onclick="showTransferModal()"' in html:
    # Remove standalone button
    import re
    html = re.sub(
        r'\s*<button id="transfer-host-btn"[^>]*class="listen-btn[^"]*"[^>]*>.*?</button>',
        '',
        html,
        flags=re.DOTALL
    )
    print("✅ HTML: standalone transfer-host-btn removed from listen-wrapper")

# Add transfer-host-btn inside session-code-actions if not there
if 'session-action-transfer' not in html:
    OLD_LEAVE = """            <button class="session-action-btn session-action-leave" onclick="leaveSession()">
              <i class="fas fa-sign-out-alt"></i> Leave
            </button>"""
    NEW_LEAVE = """            <button id="transfer-host-btn" class="session-action-btn session-action-transfer hidden" onclick="showTransferModal()" title="Transfer Host">
              <i class="fas fa-crown"></i> Transfer Host
            </button>
            <button class="session-action-btn session-action-leave" onclick="leaveSession()">
              <i class="fas fa-sign-out-alt"></i> Leave
            </button>"""
    if OLD_LEAVE in html:
        html = html.replace(OLD_LEAVE, NEW_LEAVE)
        print("✅ HTML: transfer-host-btn added inside session-code-actions")
    else:
        print("⚠️  HTML: leave button pattern not found — transfer btn may already be in place")
else:
    print("✅ HTML: transfer-host-btn already in session-code-actions")

with open('normal.html', 'w') as f:
    f.write(html)

# ── 3. FIX css/normal.css ────────────────────────────────────────
with open('css/normal.css', 'r') as f:
    css = f.read()

if 'session-action-transfer' not in css:
    css += """
/* ── TRANSFER HOST ── */
.session-action-transfer { color: #ff9500; border-color: rgba(255,149,0,0.2); }
.session-action-transfer:hover { background: rgba(255,149,0,0.1); border-color: #ff9500; }
.transfer-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 10px;
  max-height: 300px; overflow-y: auto;
}
.transfer-list-empty { color: var(--muted); font-size: 0.88rem; text-align: center; padding: 1.5rem 0; }
.transfer-list-item {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel-2); border: 1px solid var(--glass-border);
  border-radius: var(--radius); padding: 12px 14px; gap: 12px; transition: border-color 0.2s;
}
.transfer-list-item:hover { border-color: var(--accent); }
.transfer-user-info { display: flex; align-items: center; gap: 10px; }
.transfer-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 0.95rem; color: #fff; flex-shrink: 0;
}
.transfer-name { font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600; color: var(--text); }
.transfer-pick-btn {
  background: linear-gradient(135deg, #ff9500, #ff4500) !important;
  color: #fff !important; padding: 8px 14px !important; font-size: 0.82rem !important;
  white-space: nowrap; flex-shrink: 0; border: none; border-radius: 11px;
  cursor: pointer; font-family: 'Outfit', sans-serif; font-weight: 600; transition: all 0.2s;
}
.transfer-pick-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
"""
    with open('css/normal.css', 'w') as f:
        f.write(css)
    print("✅ CSS: transfer host styles added")
else:
    print("✅ CSS: transfer host styles already present")

print("\n🎉 All done! Commit and push to deploy.")