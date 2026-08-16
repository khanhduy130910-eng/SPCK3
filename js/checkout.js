// ==========================================================================
// CHECKOUT.JS
// Script của trang thanh toán (checkout.html).
//
// File này làm gì:
//   - Bắt buộc đăng nhập (requireAuth).
//   - Đọc giỏ hàng Carts/{uid} và hiển thị tổng tiền.
//   - Điền sẵn họ tên / điện thoại / địa chỉ từ Users/{uid}.
//   - Validate form rồi tạo document Orders/{orderId}.
//   - Xoá giỏ hàng, hiển thị mã đơn và chuyển sang trang đơn hàng.
//
// File nào sử dụng nó: checkout.html
// Firebase service được sử dụng: Authentication + Cloud Firestore
//   (Carts, Orders, Users).
// ==========================================================================

import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { db, COLLECTIONS } from "./firebase-config.js";
import { requireAuth, getCurrentProfile, updateOwnProfile } from "./auth.js";
import { getCartItems, cartTotals, clearCart } from "./cart.js";
import { initChatbot } from "./chatbot.js";
import {
  escapeHtml,
  formatCurrency,
  primaryImage,
  bindImageFallback,
  reportError,
  setButtonLoading,
  showToast,
  stateBlock,
} from "./utils.js";

/** Các phương thức thanh toán được hỗ trợ. */
const PAYMENT_METHODS = [
  { value: "cod", label: "Thanh toán khi nhận hàng (COD)" },
  { value: "bank", label: "Chuyển khoản ngân hàng" },
];

/** Điểm khởi động của trang thanh toán. */
async function initCheckoutPage() {
  renderHeader();
  renderFooter();
  initChatbot();

  const session = await requireAuth();
  if (!session) return;

  const listEl = document.getElementById("checkout-items");
  const summaryEl = document.getElementById("checkout-summary");
  const formEl = document.getElementById("checkout-form");
  const paymentEl = document.getElementById("payment-methods");
  if (!listEl || !summaryEl || !formEl) return;

  paymentEl.innerHTML = PAYMENT_METHODS.map(
    (method, index) => `<label class="checkbox-row">
      <input type="radio" name="paymentMethod" value="${method.value}" ${
      index === 0 ? "checked" : ""
    }>
      <span>${escapeHtml(method.label)}</span>
    </label>`
  ).join("");

  // Điền sẵn thông tin từ profile.
  const profile = getCurrentProfile() || {};
  formEl.customerName.value = profile.name || session.user.displayName || "";
  formEl.phone.value = profile.phone || "";
  formEl.address.value = profile.address || "";

  let items = [];
  try {
    items = await getCartItems(session.user.uid);
  } catch (error) {
    reportError("checkout/loadCart", error);
    return;
  }

  if (!items.length) {
    listEl.innerHTML = stateBlock({
      title: "Giỏ hàng trống",
      text: "Bạn cần có sản phẩm trong giỏ để thanh toán.",
      actionHtml: `<p><a class="btn" href="products.html">Mua sắm ngay</a></p>`,
    });
    summaryEl.innerHTML = "";
    formEl.classList.add("hidden");
    return;
  }

  renderItems(listEl, items);
  const totals = cartTotals(items);
  renderSummary(summaryEl, totals);

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    submitOrder(formEl, session.user, items, totals);
  });
}

/**
 * Render danh sách sản phẩm sẽ đặt.
 * @param {HTMLElement} listEl
 * @param {Array<object>} items
 */
function renderItems(listEl, items) {
  listEl.innerHTML = items
    .map(
      (item) => `<div class="order-line">
        <img src="${escapeHtml(primaryImage(item, item.name))}"
          alt="${escapeHtml(item.name)}" data-fallback="${escapeHtml(item.name.slice(0, 8))}">
        <div style="flex:1">
          <div style="font-weight:700">${escapeHtml(item.name)}</div>
          <div class="text-muted">${item.quantity} × ${formatCurrency(item.price)}</div>
        </div>
        <strong>${formatCurrency(item.price * item.quantity)}</strong>
      </div>`
    )
    .join("");
  bindImageFallback(listEl);
}

/**
 * Render khối tổng tiền.
 * @param {HTMLElement} summaryEl
 * @param {{count: number, subtotal: number, shipping: number, total: number}} totals
 */
function renderSummary(summaryEl, totals) {
  summaryEl.innerHTML = `
    <div class="summary-row"><span>Số sản phẩm</span><strong>${totals.count}</strong></div>
    <div class="summary-row"><span>Tạm tính</span><strong>${formatCurrency(
      totals.subtotal
    )}</strong></div>
    <div class="summary-row"><span>Phí vận chuyển</span><strong>${
      totals.shipping === 0 ? "Miễn phí" : formatCurrency(totals.shipping)
    }</strong></div>
    <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(
      totals.total
    )}</span></div>`;
}

/**
 * Validate và tạo đơn hàng trong Firestore.
 * @param {HTMLFormElement} formEl
 * @param {object} user
 * @param {Array<object>} items
 * @param {{subtotal: number, shipping: number, total: number}} totals
 */
async function submitOrder(formEl, user, items, totals) {
  const button = formEl.querySelector('button[type="submit"]');
  const customerName = formEl.customerName.value.trim();
  const phone = formEl.phone.value.trim();
  const address = formEl.address.value.trim();
  const note = formEl.note.value.trim();
  const paymentMethod = formEl.paymentMethod.value;

  const errors = {
    customerName: customerName.length < 2 ? "Vui lòng nhập họ tên." : "",
    phone: /^0\d{8,10}$/.test(phone)
      ? ""
      : "Số điện thoại không hợp lệ (ví dụ 0912345678).",
    address: address.length < 8 ? "Địa chỉ quá ngắn." : "",
  };
  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = formEl.querySelector(`[data-error="${field}"]`);
    if (errorEl) errorEl.textContent = message;
  });
  if (Object.values(errors).some(Boolean)) {
    showToast("Vui lòng kiểm tra lại thông tin giao hàng.", "warning");
    return;
  }

  setButtonLoading(button, true, "Đang đặt hàng...");
  try {
    const reference = await addDoc(collection(db, COLLECTIONS.orders), {
      uid: user.uid,
      products: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
      })),
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total,
      customerName,
      phone,
      address,
      note,
      paymentMethod,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Lưu lại thông tin giao hàng vào profile để lần sau điền sẵn (không chặn
    // luồng đặt hàng nếu thất bại).
    try {
      await updateOwnProfile({ name: customerName, phone, address });
    } catch (error) {
      console.warn("[checkout] Không cập nhật được profile:", error);
    }

    await clearCart(user.uid);
    showToast(`Đặt hàng thành công! Mã đơn: ${reference.id.slice(0, 8).toUpperCase()}`, "success", 5000);
    setTimeout(() => {
      location.href = `orders.html?new=${encodeURIComponent(reference.id)}`;
    }, 900);
  } catch (error) {
    reportError("checkout/createOrder", error);
  } finally {
    setButtonLoading(button, false);
  }
}

initCheckoutPage().catch((error) => reportError("checkout/init", error));
