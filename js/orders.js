// ==========================================================================
// ORDERS.JS
// Script của trang đơn hàng người dùng (orders.html).
//
// File này làm gì:
//   - Bắt buộc đăng nhập.
//   - Đọc Orders where uid == user.uid (người dùng chỉ thấy đơn của mình).
//   - Lọc theo trạng thái, phân trang, highlight đơn vừa tạo (?new=ORDER_ID).
//   - Cho phép huỷ đơn khi trạng thái vẫn là "pending".
//
// File nào sử dụng nó: orders.html
// Firebase service được sử dụng: Authentication + Cloud Firestore (Orders).
// ==========================================================================

import {
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { renderPagination, paginate } from "../components/pagination.js";
import { db, COLLECTIONS } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { fetchMyOrders } from "./data.js";
import { initChatbot } from "./chatbot.js";
import {
  confirmAction,
  escapeHtml,
  formatCurrency,
  formatDate,
  getUrlParams,
  orderStatusPill,
  primaryImage,
  bindImageFallback,
  reportError,
  showToast,
  stateBlock,
  ORDER_STATUS_LABELS,
} from "./utils.js";

const PAGE_SIZE = 5;

let orders = [];
let statusFilter = "";
let page = 1;
let listEl = null;
let paginationEl = null;

/** Điểm khởi động của trang đơn hàng. */
async function initOrdersPage() {
  renderHeader();
  renderFooter();
  initChatbot();

  const session = await requireAuth();
  if (!session) return;

  listEl = document.getElementById("orders-list");
  paginationEl = document.getElementById("orders-pagination");
  const filterEl = document.getElementById("orders-status");
  if (!listEl) return;

  if (filterEl) {
    filterEl.innerHTML =
      `<option value="">Tất cả trạng thái</option>` +
      Object.entries(ORDER_STATUS_LABELS)
        .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
        .join("");
    filterEl.addEventListener("change", (event) => {
      statusFilter = event.target.value;
      page = 1;
      render();
    });
  }

  listEl.innerHTML = `<div class="state"><span class="spinner"></span> Đang tải đơn hàng...</div>`;

  try {
    orders = await fetchMyOrders(session.user.uid);
  } catch (error) {
    const message = reportError("orders/fetch", error, { silent: true });
    listEl.innerHTML = stateBlock({
      title: "Không tải được đơn hàng",
      text: message,
      type: "error",
    });
    return;
  }

  const { new: newOrderId } = getUrlParams();
  if (newOrderId) {
    showToast(
      `Đơn hàng ${newOrderId.slice(0, 8).toUpperCase()} đã được tạo và đang chờ xác nhận.`,
      "success",
      5000
    );
  }

  render(newOrderId);
}

/**
 * Render danh sách đơn theo filter + phân trang.
 * @param {string} [highlightId]
 */
function render(highlightId = "") {
  const filtered = statusFilter
    ? orders.filter((order) => order.status === statusFilter)
    : orders;

  if (!filtered.length) {
    listEl.innerHTML = stateBlock({
      title: orders.length ? "Không có đơn nào ở trạng thái này" : "Bạn chưa có đơn hàng",
      text: orders.length ? "Thử chọn trạng thái khác." : "Hãy chọn sản phẩm và đặt hàng.",
      actionHtml: orders.length
        ? ""
        : `<p><a class="btn" href="products.html">Mua sắm ngay</a></p>`,
    });
    renderPagination(paginationEl, {
      page: 1,
      totalItems: 0,
      pageSize: PAGE_SIZE,
      onChange: () => {},
    });
    return;
  }

  listEl.innerHTML = paginate(filtered, page, PAGE_SIZE)
    .map((order) => orderCardHtml(order, order.id === highlightId))
    .join("");
  bindImageFallback(listEl);

  listEl.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => cancelOrder(button.dataset.cancel));
  });

  renderPagination(paginationEl, {
    page,
    totalItems: filtered.length,
    pageSize: PAGE_SIZE,
    onChange: (next) => {
      page = next;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
}

/**
 * HTML cho một thẻ đơn hàng.
 * @param {object} order
 * @param {boolean} highlight
 * @returns {string}
 */
function orderCardHtml(order, highlight) {
  const products = Array.isArray(order.products) ? order.products : [];
  return `<article class="order-card ${highlight ? "fade-in" : ""}"
      style="${highlight ? "border-color:var(--color-black)" : ""}">
    <div class="order-card__head">
      <span class="order-card__code">#${escapeHtml(order.id.slice(0, 8).toUpperCase())}</span>
      <span class="text-muted" style="font-size:var(--fs-sm)">${formatDate(order.createdAt, {
        withTime: true,
      })}</span>
      ${orderStatusPill(order.status)}
      <strong style="margin-left:auto">${formatCurrency(order.total)}</strong>
    </div>
    ${products
      .map(
        (item) => `<div class="order-line">
          <img src="${escapeHtml(primaryImage(item, item.name || "SPORT"))}"
            alt="${escapeHtml(item.name || "")}" data-fallback="${escapeHtml(
          String(item.name || "SPORT").slice(0, 8)
        )}">
          <div style="flex:1">
            <a href="product-detail.html?id=${escapeHtml(item.productId || "")}"
              style="font-weight:700">${escapeHtml(item.name || "Sản phẩm")}</a>
            <div class="text-muted">${item.quantity} × ${formatCurrency(item.price)}</div>
          </div>
          <span>${formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</span>
        </div>`
      )
      .join("")}
    <div class="summary-row" style="border-top:1px solid var(--color-gray-200);margin-top:var(--space-2)">
      <span>Giao tới</span>
      <span style="text-align:right;max-width:60%">${escapeHtml(
        order.customerName || ""
      )} · ${escapeHtml(order.phone || "")}<br>${escapeHtml(order.address || "")}</span>
    </div>
    ${
      order.note
        ? `<div class="summary-row"><span>Ghi chú</span><span>${escapeHtml(
            order.note
          )}</span></div>`
        : ""
    }
    ${
      order.status === "pending"
        ? `<div style="margin-top:var(--space-3)">
             <button class="btn btn--outline btn--sm" type="button" data-cancel="${escapeHtml(
               order.id
             )}">Huỷ đơn</button>
           </div>`
        : ""
    }
  </article>`;
}

/**
 * Huỷ một đơn hàng đang ở trạng thái pending.
 * @param {string} orderId
 */
async function cancelOrder(orderId) {
  const ok = await confirmAction("Bạn chắc chắn muốn huỷ đơn hàng này?", {
    title: "Huỷ đơn hàng",
    confirmText: "Huỷ đơn",
    danger: true,
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.orders, orderId), {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
    const target = orders.find((order) => order.id === orderId);
    if (target) target.status = "cancelled";
    showToast("Đã huỷ đơn hàng.", "success");
    render();
  } catch (error) {
    reportError("orders/cancel", error);
  }
}

initOrdersPage().catch((error) => reportError("orders/init", error));
