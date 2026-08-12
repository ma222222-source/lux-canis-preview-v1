const header = document.querySelector('.site-header');
const dialog = document.querySelector('#product-dialog');
const dialogImage = document.querySelector('#dialog-image');
const dialogTitle = document.querySelector('#dialog-title');
const dialogDescription = document.querySelector('#dialog-description');
const dialogColor = document.querySelector('#dialog-color');
const closeButton = document.querySelector('.dialog-close');
const toast = document.querySelector('#toast');
let toastTimer;

window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelectorAll('.product-open').forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('.product-card');
    dialogImage.src = card.dataset.image;
    dialogImage.alt = `${card.dataset.name}の商品写真`;
    dialogTitle.textContent = card.dataset.name;
    dialogDescription.textContent = card.dataset.copy;
    dialogColor.textContent = card.dataset.color;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
});

function closeDialog() {
  if (dialog?.open) dialog.close();
  document.body.classList.remove('dialog-open');
}

closeButton?.addEventListener('click', closeDialog);
dialog?.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
dialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));

function showToast() {
  clearTimeout(toastTimer);
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

document.querySelectorAll('.pseudo-mercari').forEach((button) => button.addEventListener('click', showToast));
