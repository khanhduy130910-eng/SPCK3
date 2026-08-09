// ==========================================================================
// PAGINATION.JS
// Component phân trang tái sử dụng (client-side).
//
// File này làm gì: render các nút số trang vào một container và gọi callback
//   khi người dùng chọn trang khác.
// File nào sử dụng nó: js/products.js, js/admin.js, js/orders.js.
// Firebase service được sử dụng: không.
// ==========================================================================

/**
 * Render phân trang.
 * @param {HTMLElement|null} container
 * @param {{page: number, totalItems: number, pageSize: number, onChange: (page: number) => void, maxButtons?: number}} options
 */
export function renderPagination(container, options) {
  if (!container) return;
  const { page, totalItems, pageSize, onChange, maxButtons = 5 } = options;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const current = Math.min(Math.max(1, page), totalPages);
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  const buttons = [];
  buttons.push(button("‹ Trước", current - 1, false, current === 1));
  if (start > 1) {
    buttons.push(button("1", 1, current === 1, false));
    if (start > 2) buttons.push(`<span class="pagination__btn" aria-hidden="true">…</span>`);
  }
  for (let index = start; index <= end; index += 1) {
    buttons.push(button(String(index), index, index === current, false));
  }
  if (end < totalPages) {
    if (end < totalPages - 1)
      buttons.push(`<span class="pagination__btn" aria-hidden="true">…</span>`);
    buttons.push(button(String(totalPages), totalPages, current === totalPages, false));
  }
  buttons.push(button("Sau ›", current + 1, false, current === totalPages));

  container.innerHTML = buttons.join("");
  container.querySelectorAll("button[data-page]").forEach((element) => {
    element.addEventListener("click", () => {
      const target = Number(element.dataset.page);
      if (Number.isFinite(target) && target !== current) onChange(target);
    });
  });
}

/**
 * Tạo HTML cho một nút phân trang.
 * @param {string} label
 * @param {number} targetPage
 * @param {boolean} active
 * @param {boolean} disabled
 * @returns {string}
 */
function button(label, targetPage, active, disabled) {
  return `<button class="pagination__btn ${active ? "is-active" : ""}" type="button"
    data-page="${targetPage}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

/**
 * Cắt một mảng theo trang hiện tại.
 * @template T
 * @param {T[]} items
 * @param {number} page
 * @param {number} pageSize
 * @returns {T[]}
 */
export function paginate(items, page, pageSize) {
  const start = (Math.max(1, page) - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
