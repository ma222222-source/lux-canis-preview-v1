(() => {
  const form = document.querySelector('#change-password-form');
  const current = document.querySelector('#current-password');
  const next = document.querySelector('#new-password');
  const confirmation = document.querySelector('#confirm-new-password');
  const status = document.querySelector('#change-password-status');
  const logoutButton = document.querySelector('#logout-all-button');
  let busy = false;
  const controls = [...form.querySelectorAll('input, button'), logoutButton];
  function setBusy(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    controls.forEach((control) => { control.disabled = value; });
  }
  function requireLogin(message) {
    form.reset();
    state.user = null;
    state.restock = [];
    renderAccount();
    showView('profile');
    document.querySelector('[data-auth="login"]').click();
    document.querySelector('#account-security-feedback').textContent = message;
    document.querySelector('#account-password').focus();
  }
  document.querySelector('#account-form').addEventListener('submit', () => {
    document.querySelector('#account-security-feedback').textContent = '';
  });
  for (const input of [next, confirmation]) input.addEventListener('input', () => {
    next.setCustomValidity('');
    confirmation.setCustomValidity('');
    status.textContent = '';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    next.setCustomValidity(next.value !== next.value.trim() ? '先頭・末尾に空白は使えません。' : '');
    confirmation.setCustomValidity(confirmation.value !== next.value ? '新しいパスワードが一致しません。' : '');
    if (!form.reportValidity()) return;
    const payload = { currentPassword: current.value, newPassword: next.value };
    setBusy(true);
    status.textContent = 'パスワードを変更しています…';
    try {
      await api('auth/password', { method: 'POST', body: JSON.stringify(payload) });
      requireLogin('パスワードを変更しました。新しいパスワードでログインしてください。');
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); }
  });
  logoutButton.addEventListener('click', async () => {
    if (busy) return;
    const message = document.querySelector('#logout-all-status');
    setBusy(true);
    message.textContent = 'すべての端末からログアウトしています…';
    try {
      await api('auth/logout-all', { method: 'POST', body: '{}' });
      requireLogin('すべての端末からログアウトしました。');
      message.textContent = '';
    } catch (error) { message.textContent = error.message; }
    finally { setBusy(false); }
  });
})();
