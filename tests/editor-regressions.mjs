import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Isolate the real submit handler; no browser, credentials or server involved.
const source = readFileSync(new URL('../admin.js', import.meta.url), 'utf8');
const start = source.indexOf("productForm.addEventListener('submit'");
const end = source.indexOf("$('#delete-product').addEventListener", start);
assert(start > 0 && end > start);
function setup({ fail = false, published = false } = {}) {
  let submit, release, calls = 0, closed = 0, message = '';
  const error = { hidden: true, textContent: '' };
  const fields = [{ disabled: false }, { disabled: true }];
  const buttons = [{ disabled: false }, { disabled: true }];
  const form = {
    elements: { published: { checked: published } },
    setAttribute() {},
    addEventListener(type, callback) { submit = callback; }
  };
  const context = vm.createContext({
    productSaving: false, productForm: form,
    state: { variants: [], images: [], editingId: null, editorDirty: true },
    $: () => error,
    $$: selector => selector === 'button' ? buttons : fields,
    FormData: class { *[Symbol.iterator]() { yield ['name', 'テスト']; yield ['price', '2500']; } },
    setBusy() {}, uploadImages: () => new Promise(resolve => { release = resolve; }),
    api: async (path, options) => { calls++; assert.equal(JSON.parse(options.body).published, published); if (fail) throw Error('保存できませんでした'); },
    editor: { close() { closed++; } },
    loadAll: async () => {},
    notify(text) { message = text; },
    renderImagePreviews() {}, renderVariantEditor() {}
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, error, fields, buttons, submit: () => submit({ preventDefault() {} }), release: () => release(), result: () => ({ calls, closed, message }) };
}

const ok = setup();
const pending = ok.submit();
assert.equal(ok.fields[0].disabled, true);
assert.equal(ok.buttons[0].disabled, true);
await ok.submit();
ok.release();
await pending;
assert.deepEqual(ok.result(), { calls: 1, closed: 1, message: '商品を非公開で保存しました。' });
assert.equal(ok.fields[0].disabled, false);
assert.equal(ok.fields[1].disabled, true);
assert.equal(ok.buttons[1].disabled, true);
assert.equal(ok.context.productSaving, false);
console.log('✓ 二重保存を防止し、保存中だけ入力をロック');
console.log('✓ 非公開保存の完了文言と、元から無効な項目の状態を維持');

const failure = setup({ fail: true });
const rejected = failure.submit();
failure.release();
await rejected;
assert.equal(failure.error.hidden, false);
assert.equal(failure.error.textContent, '保存できませんでした');
assert.equal(failure.result().closed, 0);
assert.equal(failure.context.state.editorDirty, true);
assert.equal(failure.fields[0].disabled, false);
console.log('✓ 失敗時はダイアログ内にエラーを表示し、編集内容を保持');

const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../guide.html', import.meta.url), 'utf8');
assert(!home.includes('今、見てほしいもの'));
assert(!home.includes('光のかけら'));
assert(!guide.includes('はじめての方へ'));
assert(!guide.includes('<br>'));
assert.match(source, /editor.addEventListener\('cancel'/);
console.log('✓ 不要な見出し・強制改行を削除し、Escapeにも未保存確認を適用');
console.log('Editor regression tests passed.');
