// ==========================================================================
// TOAST.JS
// Component thông báo nổi (toast) dùng chung cho toàn site.
//
// File này làm gì: tạo/duy trì một stack toast ở góc phải dưới màn hình.
// File nào sử dụng nó: js/utils.js (re-export qua showToast), và mọi trang
//   thông qua utils.showToast().
// Firebase service được sử dụng: không.
// ==========================================================================

const STACK_ID = "toast-stack";

/**
 * Lấy (hoặc tạo mới nếu chưa có) container chứa toast.
 * @returns {HTMLElement}
 */
function getStack() {
  let stack = document.getElementById(STACK_ID);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = STACK_ID;
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  return stack;
}

/**
 * Hiển thị một toast rồi tự động ẩn sau `duration` ms.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type="info"]
 * @param {number} [duration=3200]
 */
export function showToast(message, type = "info", duration = 3200) {
  const stack = getStack();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = String(message ?? "");
  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 200);
  };
  const timer = setTimeout(remove, Math.max(1200, duration));
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}
