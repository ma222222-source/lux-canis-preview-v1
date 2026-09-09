const form = document.querySelector('#contact-form');
const steps = ['input','confirm','complete'];
function showStep(name) { steps.forEach((step) => { document.querySelector(`#step-${step}`).classList.toggle('is-active', step === name); document.querySelector(`[data-step-label="${step}"]`).classList.toggle('is-active', step === name); }); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
document.querySelector('#to-confirm').addEventListener('click', () => {
  let valid = true;
  form.querySelectorAll('#step-input [required]').forEach((input) => { const error = input.closest('label').querySelector('.field-error'); error.textContent = ''; if (!input.value.trim() || !input.checkValidity()) { error.textContent = input.type === 'email' ? '正しいメールアドレスを入力してください。' : '入力または選択してください。'; valid = false; } });
  if (!valid) { form.querySelector('#step-input :invalid')?.focus(); return; }
  new FormData(form).forEach((value, key) => document.querySelector(`[data-confirm="${key}"]`).textContent = value);
  showStep('confirm');
});
document.querySelector('[data-back]').addEventListener('click', () => showStep('input'));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitError = document.querySelector('#contact-submit-error');
  submitError.textContent = '';
  const button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = '送信中…';
  try {
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/contacts', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || '送信できませんでした。');
    showStep('complete'); form.reset();
  } catch (error) { submitError.textContent = `${error.message} 入力内容は残っています。時間をおいて再度お試しください。`; } finally { button.disabled = false; button.textContent = '問い合わせを送信する'; }
});
