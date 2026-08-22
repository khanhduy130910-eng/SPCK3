// ==========================================================================
// UTILS.JS
// Tập hợp toàn bộ hàm tiện ích dùng chung của project (không lặp lại ở file khác).
//
// File này làm gì:
//   - Định dạng tiền tệ, ngày tháng.
//   - Escape HTML để chống XSS khi render bằng innerHTML.
//   - Debounce, slugify, validate email/password.
//   - Đọc query string, hiển thị toast, hộp thoại xác nhận.
//   - Chuyển FirebaseError sang thông báo tiếng Việt dễ hiểu.
//
// File nào sử dụng nó: hầu hết mọi file trong js/ và components/.
//
// Firebase service được sử dụng: không (thuần JS, chỉ đọc mã lỗi Firebase).
// ==========================================================================

import { showToast as showToastComponent } from "../components/toast.js";
import { confirmModal } from "../components/modal.js";

/**
 * Định dạng số thành tiền Việt Nam. Giá trị không hợp lệ trả về "0 ₫".
 * @param {number|string} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(number);
}

/**
 * Định dạng ngày giờ. Nhận Firestore Timestamp, Date, số ms hoặc chuỗi ISO.
 * @param {*} value
 * @param {{withTime?: boolean}} [options]
 * @returns {string}
 */
export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return "—";
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
  return formatter.format(date);
}

/**
 * Chuẩn hoá nhiều kiểu dữ liệu thời gian về Date.
 * Firestore trả về Timestamp có method toDate().
 * @param {*} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

/**
 * Trì hoãn việc gọi hàm cho tới khi người dùng ngừng gõ (dùng cho ô tìm kiếm).
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} [delay=350]
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(fn, delay = 350) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Escape các ký tự đặc biệt của HTML. BẮT BUỘC dùng cho mọi dữ liệu do người
 * dùng nhập trước khi đưa vào innerHTML.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Lấy chữ cái đầu của tên để làm avatar mặc định (tối đa 2 ký tự).
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Đọc toàn bộ query string của URL hiện tại thành object.
 * @param {string} [search=location.search]
 * @returns {Record<string, string>}
 */
export function getUrlParams(search = location.search) {
  return Object.fromEntries(new URLSearchParams(search).entries());
}

/**
 * Hộp thoại xác nhận dùng modal riêng của project (không dùng window.confirm).
 * @param {string} message
 * @param {{title?: string, confirmText?: string, danger?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmAction(message, options = {}) {
  return confirmModal(message, options);
}

/**
 * Hiển thị toast thông báo.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type="info"]
 * @param {number} [duration=3200]
 */
export function showToast(message, type = "info", duration = 3200) {
  showToastComponent(message, type, duration);
}

/**
 * Kiểm tra định dạng email.
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

/**
 * Kiểm tra mật khẩu: tối thiểu 6 ký tự, có ít nhất 1 chữ và 1 số.
 * @param {string} password
 * @returns {{valid: boolean, message: string}}
 */
export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 6) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 6 ký tự." };
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return { valid: false, message: "Mật khẩu cần có cả chữ và số." };
  }
  return { valid: true, message: "" };
}

/**
 * Chuyển chuỗi tiếng Việt thành slug an toàn cho URL.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Giới hạn một số trong khoảng [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

/**
 * Ảnh dự phòng dạng SVG data-URI, dùng khi sản phẩm không có ảnh hoặc ảnh lỗi.
 * @param {string} [label="SPORT"]
 * @returns {string}
 */
export function placeholderImage(label = "SPORT") {
  const text = escapeHtml(String(label).slice(0, 22).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#18181b"/>
      <stop offset="1" stop-color="#3f3f46"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="400" cy="330" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="24"/>
  <path d="M250 470c60-26 108-70 150-140 42 70 90 114 150 140" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="20" stroke-linecap="round"/>
  <text x="400" y="620" fill="#ffffff" fill-opacity="0.92" font-family="Helvetica,Arial,sans-serif" font-size="52" font-weight="bold" letter-spacing="4" text-anchor="middle">SPORTHUB</text>
  <text x="400" y="678" fill="#ffffff" fill-opacity="0.55" font-family="Helvetica,Arial,sans-serif" font-size="34" text-anchor="middle">${text}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Gắn xử lý ảnh lỗi: tự thay bằng placeholder để tránh icon ảnh vỡ.
 * @param {ParentNode} [root=document]
 */
export function bindImageFallback(root = document) {
  root.querySelectorAll("img[data-fallback]").forEach((img) => {
    if (img.dataset.fallbackBound === "1") return;
    img.dataset.fallbackBound = "1";
    img.addEventListener("error", () => {
      // Chỉ thay một lần để tránh vòng lặp nếu placeholder cũng lỗi.
      if (img.dataset.fallbackApplied === "1") return;
      img.dataset.fallbackApplied = "1";
      img.src = placeholderImage(img.dataset.fallback || "SPORT");
    });
  });
}

/**
 * Lấy ảnh chính của một bản ghi (sản phẩm/danh mục/item giỏ hàng).
 * Ưu tiên `imageUrl`, sau đó `image`, rồi `images[0]`, cuối cùng là placeholder.
 * Logic này giữ tương thích với dữ liệu cũ đang chỉ có `image` hoặc `images[]`.
 * @param {{imageUrl?: string, image?: string, images?: string[], name?: string}} item
 * @param {string} [label] nhãn hiển thị trên placeholder
 * @returns {string}
 */
export function primaryImage(item, label) {
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  return (
    item?.imageUrl ||
    item?.image ||
    images[0] ||
    placeholderImage(label || item?.name || "SPORT")
  );
}

/**
 * Kiểm tra một URL ảnh có dùng được trên web hay không (http/https).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

/** Nhãn tiếng Việt cho từng trạng thái đơn hàng. */
export const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

/**
 * Render pill trạng thái đơn hàng.
 * @param {string} status
 * @returns {string} HTML
 */
export function orderStatusPill(status) {
  const key = ORDER_STATUS_LABELS[status] ? status : "pending";
  return `<span class="status-pill status-pill--${key}">${escapeHtml(
    ORDER_STATUS_LABELS[key]
  )}</span>`;
}

/**
 * Chuyển mã lỗi Firebase thành thông báo tiếng Việt cho người dùng.
 * @param {unknown} error
 * @param {string} [fallback="Đã có lỗi xảy ra. Vui lòng thử lại."]
 * @returns {string}
 */
export function firebaseErrorMessage(
  error,
  fallback = "Đã có lỗi xảy ra. Vui lòng thử lại."
) {
  const code = typeof error === "object" && error !== null ? error.code : "";
  const map = {
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/user-disabled": "Tài khoản đã bị khoá.",
    "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
    "auth/wrong-password": "Mật khẩu không đúng.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use": "Email này đã được sử dụng.",
    "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
    "auth/too-many-requests": "Bạn thử quá nhiều lần. Vui lòng chờ ít phút.",
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập Google.",
    "auth/popup-blocked": "Trình duyệt đã chặn popup đăng nhập Google.",
    "auth/cancelled-popup-request": "Yêu cầu đăng nhập trước đó đã bị huỷ.",
    "auth/requires-recent-login": "Vui lòng đăng nhập lại để thực hiện thao tác này.",
    "auth/network-request-failed": "Lỗi mạng. Kiểm tra kết nối Internet.",
    "auth/operation-not-allowed":
      "Phương thức đăng nhập này chưa được bật trong Firebase Console.",
    "auth/unauthorized-domain":
      "Domain hiện tại chưa được thêm vào Authorized domains của Firebase.",
    "permission-denied":
      "Bạn không có quyền thực hiện thao tác này (Firestore Security Rules).",
    unauthenticated: "Bạn cần đăng nhập để tiếp tục.",
    unavailable: "Không kết nối được Firestore. Kiểm tra kết nối mạng.",
    "storage/unauthorized": "Bạn không có quyền tải file lên (Storage Rules).",
    "storage/canceled": "Quá trình tải file đã bị huỷ.",
    "storage/retry-limit-exceeded": "Tải file thất bại, vui lòng thử lại.",
    "failed-precondition":
      "Firestore cần một composite index cho truy vấn này. Mở console để tạo index.",
  };
  if (code && map[code]) return map[code];
  const message = typeof error === "object" && error !== null ? error.message : "";
  return message ? `${fallback} (${message})` : fallback;
}

/**
 * Ghi log lỗi ra console kèm ngữ cảnh và hiện toast cho người dùng.
 * @param {string} context
 * @param {unknown} error
 * @param {{silent?: boolean}} [options]
 * @returns {string} thông báo đã hiển thị
 */
export function reportError(context, error, options = {}) {
  console.error(`[${context}]`, error);
  const message = firebaseErrorMessage(error);
  if (!options.silent) showToast(message, "error", 4200);
  return message;
}

/**
 * Đặt trạng thái "đang xử lý" cho button: khoá lại và hiện spinner.
 * @param {HTMLButtonElement|null} button
 * @param {boolean} loading
 * @param {string} [loadingText="Đang xử lý..."]
 */
export function setButtonLoading(button, loading, loadingText = "Đang xử lý...") {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span><span>${escapeHtml(
      loadingText
    )}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

/**
 * Render khối skeleton cho lưới sản phẩm trong lúc chờ Firestore.
 * @param {number} [count=8]
 * @returns {string} HTML
 */
export function productSkeletons(count = 8) {
  return Array.from({ length: count })
    .map(
      () => `<div class="skeleton-card">
        <div class="skeleton skeleton-card__media"></div>
        <div class="skeleton skeleton-line skeleton-line--sm"></div>
        <div class="skeleton skeleton-line skeleton-line--md"></div>
        <div class="skeleton skeleton-line skeleton-line--sm"></div>
      </div>`
    )
    .join("");
}

/**
 * Render khối trạng thái rỗng / lỗi dùng chung.
 * @param {{title: string, text?: string, type?: "empty"|"error", actionHtml?: string}} options
 * @returns {string} HTML
 */
export function stateBlock({ title, text = "", type = "empty", actionHtml = "" }) {
  return `<div class="state ${type === "error" ? "state--error" : ""}">
    <h3 class="state__title">${escapeHtml(title)}</h3>
    ${text ? `<p>${escapeHtml(text)}</p>` : ""}
    ${actionHtml}
  </div>`;
}

/**
 * Chuyển hướng sang trang đăng nhập và ghi nhớ trang cần quay lại.
 * @param {string} [redirect=location.pathname + location.search]
 */
export function goToLogin(redirect = location.pathname + location.search) {
  location.href = `login.html?redirect=${encodeURIComponent(redirect)}`;
}
/**
 * Chuẩn hóa chuỗi để tìm kiếm sản phẩm.
 * Loại bỏ dấu tiếng Việt, chuyển thành chữ thường
 * và loại bỏ khoảng trắng/ký tự đặc biệt.
 *
 * Ví dụ:
 * "Áo Thun Nam" -> "ao thun nam"
 * "QUẦN ĐÙI" -> "quan dui"
 *
 * @param {*} value
 * @returns {string}
 */
export function toSearchKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}