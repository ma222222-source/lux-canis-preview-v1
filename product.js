const catalog = {
  'color-mix': { name:'Color Mix', images:['item-01.webp','item-03.webp','item-06.webp'], colors:[['Pink','item-01.webp'],['Blue','item-03.webp'],['Clear','item-06.webp']], status:'new', description:'ピンク、ブルー、クリアの粒が重なる、可愛らしく透明感のあるデザイン。', material:'ガラスビーズ / 金具', fitting:'ピアス（イヤリング変更可）' },
  'forest-drop': { name:'Forest Drop', images:['item-02.webp','item-09.webp'], colors:[['Green','item-02.webp'],['Orange','item-09.webp']], status:'low', description:'深いグリーンと透明感を重ねた、落ち着いた色味のドロップデザイン。', material:'ガラスビーズ / 金具', fitting:'ピアス（イヤリング変更可）' },
  'soft-aurora': { name:'Soft Aurora', images:['item-03.webp','item-01.webp','item-06.webp'], colors:[['Pastel','item-03.webp'],['Pink','item-01.webp'],['Mix','item-06.webp']], status:'new', description:'淡い色のビーズが光を受けて、やさしくきらめくデザイン。', material:'ガラスビーズ / 金具', fitting:'ピアス' },
  'tiny-drop': { name:'Tiny Drop', images:['item-04.webp','item-08.webp'], colors:[['5 Colors','item-04.webp'],['Clear','item-08.webp']], status:'sold', description:'小さなビーズと雫モチーフを組み合わせた、日常使いしやすいデザイン。', material:'ガラスビーズ / 雫パーツ', fitting:'イヤリング（ピアス変更可）' },
  'mini-hoop': { name:'Mini Hoop', images:['item-05.webp','item-06.webp'], colors:[['Variation','item-05.webp'],['Clear','item-06.webp']], status:'', description:'ビーズを小さな輪に集めた、ころんとしたフォルム。', material:'ガラスビーズ / 金具', fitting:'ピアス（イヤリング変更可）' },
  'long-beads': { name:'Long Beads', images:['item-07.webp','item-10.webp'], colors:[['5 Colors','item-07.webp'],['Green','item-10.webp']], status:'low', description:'縦のラインを活かした、揺れ感のあるロングタイプ。', material:'ガラスビーズ / 金具', fitting:'ピアス（イヤリング変更可）' }
};
const id = new URLSearchParams(location.search).get('id') || 'color-mix';
const product = catalog[id] || catalog['color-mix'];
const mainImage = document.querySelector('#detail-image');
const thumbnails = document.querySelector('#detail-thumbnails');
const colors = document.querySelector('#color-options');
const toast = document.querySelector('#toast');
let toastTimer;

document.title = `${product.name} | Lux Canis`;
document.querySelector('#product-title').textContent = product.name;
document.querySelector('#detail-description').textContent = product.description;
document.querySelector('#detail-material').textContent = product.material;
document.querySelector('#detail-fitting').textContent = product.fitting;
const statusLabel = {new:'NEW',low:'残りわずか',sold:'SOLD OUT'}[product.status] || '';
const status = document.querySelector('#detail-status');
status.textContent = statusLabel;
status.hidden = !statusLabel;

function selectImage(file, label) {
  mainImage.src = `./assets/${file}`;
  mainImage.alt = `${product.name} ${label}の商品写真`;
  document.querySelectorAll('[data-image]').forEach(button => button.classList.toggle('is-active', button.dataset.image === file));
}

product.images.forEach((file, index) => {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.image = file; button.setAttribute('aria-label', `商品写真${index + 1}を見る`);
  button.innerHTML = `<img src="./assets/${file}" alt="" loading="lazy">`;
  button.addEventListener('click', () => selectImage(file, `写真${index + 1}`));
  thumbnails.append(button);
});
product.colors.forEach(([label,file], index) => {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.image = file; button.textContent = label; button.setAttribute('aria-pressed', String(index === 0));
  button.addEventListener('click', () => { document.querySelectorAll('#color-options button').forEach(b => b.setAttribute('aria-pressed','false')); button.setAttribute('aria-pressed','true'); selectImage(file,label); });
  colors.append(button);
});
selectImage(product.images[0], product.colors[0][0]);

if (product.status === 'sold') {
  document.querySelector('#detail-actions').innerHTML = '<div class="sold-panel"><strong>現在こちらの商品は売り切れています</strong><p>再販されたときにお知らせを受け取れます。</p><button class="button button-dark demo-action" type="button" data-message="再販通知を登録しました（デモ）。">再販通知を受け取る</button></div>';
}

function showToast(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(()=>toast.classList.remove('show'),3200); }
document.querySelectorAll('.demo-action').forEach(button => button.addEventListener('click', () => showToast(button.dataset.message)));
