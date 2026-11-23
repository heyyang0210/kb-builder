export function renderPageJump(page, pageCount, scope) {
  if (pageCount <= 1) return '';
  return `<form class="kc-page-jump" data-kc-page-jump="${scope}" novalidate><label>跳转到第 <input type="number" name="page" min="1" max="${pageCount}" step="1" value="${page}" inputmode="numeric" required aria-label="跳转到第几页"> 页</label><button class="button secondary compact" type="submit">跳转</button><span role="alert" data-kc-page-jump-error></span></form>`;
}

export function readPageJump(form, pageCount) {
  const input = form.elements.page;
  const page = input.value.trim() === '' ? NaN : Number(input.value);
  if (!Number.isSafeInteger(page) || page < 1 || page > pageCount) {
    form.querySelector('[data-kc-page-jump-error]').textContent = `请输入 1 到 ${pageCount} 的页码`;
    input.focus();
    return null;
  }
  form.querySelector('[data-kc-page-jump-error]').textContent = '';
  return page;
}
