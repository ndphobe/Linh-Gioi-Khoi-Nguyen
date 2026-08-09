export class UIManager {
  constructor({ app, onMainMenu = () => {}, onRespawn = () => Promise.resolve() } = {}) {
    this.app = app;
    this.onMainMenu = onMainMenu;
    this.onRespawn = onRespawn;
  }

  ensureDeathDialog() {
    if (this.deathDialog) return this.deathDialog;
    const dialog = document.createElement('section');
    dialog.className = 'death-dialog-overlay';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'death-dialog-title');
    dialog.innerHTML = `<div class="death-dialog"><div class="death-dialog__seal" aria-hidden="true">魂</div><small>LUÂN HỒI CHỜ ĐỢI</small><h2 id="death-dialog-title">BẠN ĐÃ TỬ VONG</h2><p>Hồn bay phách tán, tổn hại 10% tu vi...</p><div class="death-dialog__actions"><button type="button" data-death-home>Trở về trang chủ</button><button type="button" data-death-respawn>Trở về sảnh điện</button></div></div>`;
    dialog.querySelector('[data-death-home]').addEventListener('click', () => this.onMainMenu());
    dialog.querySelector('[data-death-respawn]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try { await this.onRespawn(); } finally { button.disabled = false; }
    });
    this.app?.appendChild(dialog);
    this.deathDialog = dialog;
    return dialog;
  }

  showDeathDialog() { const dialog = this.ensureDeathDialog(); dialog.hidden = false; requestAnimationFrame(() => dialog.classList.add('is-visible')); dialog.querySelector('[data-death-respawn]')?.focus(); }
  hideDeathDialog() { if (!this.deathDialog) return; this.deathDialog.classList.remove('is-visible'); this.deathDialog.hidden = true; }

  destroy() { this.deathDialog?.remove(); this.deathDialog = null; }

  updateGold(value, ...elements) {
    const text = Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('vi-VN');
    for (const element of elements) if (element) element.textContent = text;
  }
}
