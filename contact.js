const form = document.querySelector('#contact-form');
const steps = ['input', 'confirm', 'complete'];
let currentStep = 'input';
let sending = false;

function showStep(name) {
  currentStep = name;
  steps.forEach((step) => {
    const active = step === name;
    document.querySelector(`#step-${step}`).classList.toggle('is-active', active);
    const marker = document.querySelector(`[data-step-label="${step}"]`);
    marker.classList.toggle('is-active', active);
    if (active) marker.setAttribute('aria-current', 'step');
    else marker.removeAttribute('aria-current');
  });
  const target = name === 'input' ? form.querySelector('[name="name"]') : document.querySelector(`#step-${name} h2`);
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  if (name === 'input') target.removeAttribute('tabindex');
  document.querySelector('.contact-panel').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

form.querySelectorAll('#step-input [required]').forEach((input) => {
  const error = input.closest('label').querySelector('.field-error');
  error.id = `contact-${input.name}-error`;
  input.setAttribute('aria-describedby', error.id);
  input.addEventListener('input', () => {
    error.textContent = '';
    input.removeAttribute('aria-invalid');
  });
});
document.querySelector('[data-step-label="input"]').setAttribute('aria-current', 'step');

function confirmInput() {
  let firstInvalid = null;
  form.querySelectorAll('#step-input [required]').forEach((input) => {
    const invalid = !input.value.trim() || !input.checkValidity();
    const error = input.closest('label').querySelector('.field-error');
    error.textContent = invalid ? (input.type === 'email' ? '正しいメールアドレスを入力してください。' : '入力または選択してください。') : '';
    input.setAttribute('aria-invalid', String(invalid));
    if (invalid && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) { firstInvalid.focus(); return; }
  new FormData(form).forEach((value, key) => {
    const target = document.querySelector(`[data-confirm="${key}"]`);
    if (target) target.textContent = String(value).trim();
  });
  showStep('confirm');
}

document.querySelector('#to-confirm').addEventListener('click', confirmInput);
document.querySelector('[data-back]').addEventListener('click', () => { if (!sending) showStep('input'); });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending || currentStep === 'complete') return;
  if (currentStep !== 'confirm') { confirmInput(); return; }
  const submitError = document.querySelector('#contact-submit-error');
  submitError.textContent = '';
  const button = form.querySelector('[type="submit"]');
  const back = form.querySelector('[data-back]');
  sending = true;
  form.setAttribute('aria-busy', 'true');
  button.disabled = back.disabled = true;
  button.textContent = '送信中…';
  try {
    const data = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value).trim()]));
    const response = await fetch('/api/contacts', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || '送信できませんでした。');
    showStep('complete');
    form.reset();
  } catch (error) {
    submitError.textContent = `${error.message} 入力内容は残っています。時間をおいて再度お試しください。`;
  } finally {
    sending = false;
    form.setAttribute('aria-busy', 'false');
    button.disabled = back.disabled = false;
    button.textContent = '問い合わせを送信する';
  }
});
