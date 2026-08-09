// ==========================================================================
// MODAL.JS
// Component modal dùng chung: hộp thoại xác nhận và modal chứa form.
//
// File này làm gì:
//   - openModal(): mở modal với nội dung HTML tuỳ ý, trả về API để đóng.
//   - confirmModal(): hộp thoại Xác nhận / Huỷ, trả về Promise<boolean>.
// File nào sử dụng nó: js/utils.js (confirmAction), js/admin.js, js/profile.js,
//   js/detail.js.
// Firebase service được sử dụng: không.
// ==========================================================================

/**
 * Mở một modal.
 * @param {{
 *   title: string,
 *   bodyHtml: string,
 *   footerHtml?: string,
 *   size?: "sm"|"md"|"lg",
 *   onMount?: (modalEl: HTMLElement, close: () => void) => void,
 *   onClose?: () => void
 * }} options
 * @returns {{element: HTMLElement, close: () => void}}
 */
export function openModal({
  title,
  bodyHtml,
  footerHtml = "",
  size = "md",
  onMount,
  onClose,
}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal modal--${size}" role="dialog" aria-modal="true" aria-label="${escapeAttr(
    title
  )}">
      <div class="modal__head">
        <h3 class="modal__title"></h3>
        <button class="icon-btn" type="button" data-modal-close aria-label="Đóng">✕</button>
      </div>
      <div class="modal__body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal__foot">${footerHtml}</div>` : ""}
    </div>`;

  // Dùng textContent cho tiêu đề để tránh XSS từ dữ liệu động.
  backdrop.querySelector(".modal__title").textContent = title;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeyDown);
    document.body.classList.remove("no-scroll");
    backdrop.remove();
    if (typeof onClose === "function") onClose();
  };

  function onKeyDown(event) {
    if (event.key === "Escape") close();
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
    if (event.target.closest("[data-modal-close]")) close();
  });
  document.addEventListener("keydown", onKeyDown);

  document.body.appendChild(backdrop);
  document.body.classList.add("no-scroll");

  const modalEl = backdrop.querySelector(".modal");
  if (typeof onMount === "function") onMount(modalEl, close);
  modalEl.querySelector("input, select, textarea, button")?.focus();

  return { element: modalEl, close };
}

/**
 * Hộp thoại xác nhận. Trả về true nếu người dùng đồng ý.
 * @param {string} message
 * @param {{title?: string, confirmText?: string, cancelText?: string, danger?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmModal(message, options = {}) {
  const {
    title = "Xác nhận",
    confirmText = "Đồng ý",
    cancelText = "Huỷ",
    danger = false,
  } = options;

  return new Promise((resolve) => {
    let result = false;
    const { element, close } = openModal({
      title,
      size: "sm",
      bodyHtml: `<p class="confirm-message"></p>`,
      footerHtml: `
        <button class="btn btn--outline" type="button" data-modal-close>${escapeAttr(
          cancelText
        )}</button>
        <button class="btn ${
          danger ? "btn--danger" : ""
        }" type="button" data-confirm>${escapeAttr(confirmText)}</button>`,
      onClose: () => resolve(result),
    });
    element.querySelector(".confirm-message").textContent = message;
    element.querySelector("[data-confirm]").addEventListener("click", () => {
      result = true;
      close();
    });
  });
}

/**
 * Escape giá trị đưa vào attribute HTML.
 * Component này không import utils.js để tránh phụ thuộc vòng tròn
 * (utils.js đã import modal.js).
 * @param {string} value
 * @returns {string}
 */
function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
