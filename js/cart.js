// ==========================================================================
// CART.JS
// Quản lý giỏ hàng của người dùng bằng Firestore (KHÔNG dùng LocalStorage).
//
// File này làm gì:
//   - Đọc/ghi document Carts/{uid}.
//   - Cung cấp subscribeCart() realtime cho header badge và trang giỏ hàng.
//   - addToCart / setQuantity / removeItem / clearCart.
//   - initCartPage(): render toàn bộ trang cart.html.
//
// File nào sử dụng nó: components/header.js, components/product-card.js,
//   js/detail.js, js/checkout.js, cart.html
//
// Firebase service được sử dụng: Cloud Firestore + Authentication (lấy uid).
// ==========================================================================

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, COLLECTIONS } from "./firebase-config.js";
import { getCurrentUser, onUserChanged, waitForAuth } from "./auth.js";
import {
  escapeHtml,
  formatCurrency,
  primaryImage,
  bindImageFallback,
  reportError,
  showToast,
  clamp,
  setButtonLoading,
  confirmAction,
  stateBlock,
  goToLogin,
} from "./utils.js";

/** Số lượng tối đa cho một dòng sản phẩm trong giỏ. */
const MAX_QTY = 99;

/**
 * Lấy DocumentReference tới giỏ hàng của một user.
 * @param {string} uid
 */
function cartRef(uid) {
  return doc(db, COLLECTIONS.carts, uid);
}

/**
 * Chuẩn hoá dữ liệu một dòng giỏ hàng (phòng dữ liệu cũ/thiếu field).
 * @param {object} item
 */
function normalizeItem(item) {
  return {
    productId: String(item?.productId || ""),
    name: String(item?.name || "Sản phẩm"),
    price: Number(item?.price) || 0,
    image: String(item?.image || ""),
    quantity: clamp(Number(item?.quantity) || 1, 1, MAX_QTY),
  };
}

/**
 * Đọc items hiện tại của giỏ hàng.
 * @param {string} uid
 * @returns {Promise<Array<object>>}
 */
export async function getCartItems(uid) {
  const snapshot = await getDoc(cartRef(uid));
  if (!snapshot.exists()) return [];
  const items = snapshot.data()?.items;
  return Array.isArray(items) ? items.map(normalizeItem) : [];
}

/**
 * Ghi lại toàn bộ items của giỏ hàng (merge để giữ các field khác).
 * @param {string} uid
 * @param {Array<object>} items
 */
async function writeCart(uid, items) {
  await setDoc(
    cartRef(uid),
    { uid, items: items.map(normalizeItem), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Tính tổng tiền và tổng số lượng.
 * @param {Array<{price: number, quantity: number}>} items
 * @returns {{count: number, subtotal: number, shipping: number, total: number}}
 */
export function cartTotals(items) {
  const list = Array.isArray(items) ? items : [];
  const count = list.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const subtotal = list.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  // Miễn phí vận chuyển cho đơn từ 1.000.000 ₫.
  const shipping = subtotal === 0 || subtotal >= 1_000_000 ? 0 : 30_000;
  return { count, subtotal, shipping, total: subtotal + shipping };
}

/**
 * Lắng nghe giỏ hàng realtime theo user đang đăng nhập.
 * Tự động hủy/khởi tạo lại listener khi user đổi (đăng nhập/đăng xuất).
 * @param {(items: Array<object>) => void} callback
 * @returns {() => void} hàm huỷ đăng ký
 */
export function subscribeCart(callback) {
  let unsubscribeSnapshot = null;

  const unsubscribeAuth = onUserChanged((user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) {
      callback([]);
      return;
    }
    unsubscribeSnapshot = onSnapshot(
      cartRef(user.uid),
      (snapshot) => {
        const items = snapshot.exists() ? snapshot.data()?.items : [];
        callback(Array.isArray(items) ? items.map(normalizeItem) : []);
      },
      (error) => {
        reportError("cart/subscribe", error, { silent: true });
        callback([]);
      }
    );
  });

  return () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeAuth();
  };
}

/**
 * Thêm sản phẩm vào giỏ hàng.
 * Kiểm tra đăng nhập trước khi thực hiện, sau đó cập nhật Carts/{uid}.
 * @param {{id: string, name?: string, price?: number, image?: string, stock?: number}} product
 * @param {number} [quantity=1]
 * @param {HTMLButtonElement|null} [button] nút bấm để hiện trạng thái loading
 * @returns {Promise<boolean>} true nếu thêm thành công
 */
export async function addToCart(product, quantity = 1, button = null) {
  const { user } = await waitForAuth();
  if (!user) {
    showToast("Bạn cần đăng nhập để thêm sản phẩm vào giỏ.", "warning");
    goToLogin();
    return false;
  }
  const stock = Number(product?.stock ?? 0);
  if (stock <= 0) {
    showToast("Sản phẩm đã hết hàng.", "error");
    return false;
  }

  setButtonLoading(button, true, "Đang thêm...");
  try {
    const items = await getCartItems(user.uid);
    const existing = items.find((item) => item.productId === product.id);
    const desired = (existing ? existing.quantity : 0) + Math.max(1, Number(quantity) || 1);
    if (desired > stock) {
      showToast(`Chỉ còn ${stock} sản phẩm trong kho.`, "warning");
      setButtonLoading(button, false);
      return false;
    }
    if (existing) {
      existing.quantity = clamp(desired, 1, MAX_QTY);
    } else {
      items.push({
        productId: product.id,
        name: product.name || "Sản phẩm",
        price: Number(product.price) || 0,
        // Sản phẩm có thể chỉ có images[] nên lấy ảnh đầu tiên làm ảnh chính.
        image: product.image || (Array.isArray(product.images) ? product.images[0] : "") || "",
        quantity: clamp(desired, 1, MAX_QTY),
      });
    }
    await writeCart(user.uid, items);
    showToast("Đã thêm vào giỏ hàng.", "success");
    return true;
  } catch (error) {
    reportError("cart/add", error);
    return false;
  } finally {
    setButtonLoading(button, false);
  }
}

/**
 * Đặt số lượng cho một dòng trong giỏ. Số lượng <= 0 sẽ xoá dòng đó.
 * @param {string} productId
 * @param {number} quantity
 */
export async function setQuantity(productId, quantity) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const items = await getCartItems(user.uid);
    const next = Number(quantity);
    if (!Number.isFinite(next) || next <= 0) {
      await writeCart(
        user.uid,
        items.filter((item) => item.productId !== productId)
      );
      return;
    }
    const target = items.find((item) => item.productId === productId);
    if (!target) return;
    target.quantity = clamp(next, 1, MAX_QTY);
    await writeCart(user.uid, items);
  } catch (error) {
    reportError("cart/setQuantity", error);
  }
}

/**
 * Xoá một sản phẩm khỏi giỏ.
 * @param {string} productId
 */
export async function removeItem(productId) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const items = await getCartItems(user.uid);
    await writeCart(
      user.uid,
      items.filter((item) => item.productId !== productId)
    );
    showToast("Đã xoá sản phẩm khỏi giỏ.", "info");
  } catch (error) {
    reportError("cart/remove", error);
  }
}

/**
 * Xoá toàn bộ giỏ hàng (dùng cả sau khi đặt hàng thành công).
 * @param {string} [uid] mặc định là user hiện tại
 */
export async function clearCart(uid = getCurrentUser()?.uid) {
  if (!uid) return;
  await writeCart(uid, []);
}

// --------------------------------------------------------------------------
// Trang cart.html
// --------------------------------------------------------------------------

/**
 * Khởi tạo trang giỏ hàng: render realtime, xử lý tăng/giảm/nhập số lượng,
 * xoá từng sản phẩm và xoá toàn bộ.
 */
export function initCartPage() {
  const listEl = document.getElementById("cart-list");
  const summaryEl = document.getElementById("cart-summary");
  const clearBtn = document.getElementById("cart-clear");
  if (!listEl || !summaryEl) return;

  listEl.innerHTML = `<div class="state"><span class="spinner"></span> Đang tải giỏ hàng...</div>`;

  onUserChanged((user) => {
    if (!user) {
      listEl.innerHTML = stateBlock({
        title: "Bạn chưa đăng nhập",
        text: "Đăng nhập để xem giỏ hàng được lưu trên Firestore.",
        actionHtml: `<p><a class="btn" href="login.html?redirect=cart.html">Đăng nhập</a></p>`,
      });
      summaryEl.innerHTML = "";
      clearBtn?.classList.add("hidden");
    }
  });

  subscribeCart((items) => {
    if (!getCurrentUser()) return;
    renderCartList(listEl, items);
    renderCartSummary(summaryEl, items);
    clearBtn?.classList.toggle("hidden", items.length === 0);
  });

  clearBtn?.addEventListener("click", async () => {
    const ok = await confirmAction("Xoá toàn bộ sản phẩm trong giỏ hàng?", {
      title: "Xoá giỏ hàng",
      confirmText: "Xoá hết",
      danger: true,
    });
    if (!ok) return;
    try {
      await clearCart();
      showToast("Đã xoá toàn bộ giỏ hàng.", "success");
    } catch (error) {
      reportError("cart/clear", error);
    }
  });
}

/**
 * Render danh sách dòng sản phẩm trong giỏ.
 * @param {HTMLElement} listEl
 * @param {Array<object>} items
 */
function renderCartList(listEl, items) {
  if (!items.length) {
    listEl.innerHTML = stateBlock({
      title: "Giỏ hàng đang trống",
      text: "Hãy chọn vài sản phẩm yêu thích của bạn.",
      actionHtml: `<p><a class="btn" href="products.html">Mua sắm ngay</a></p>`,
    });
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const image = primaryImage(item, item.name);
      return `<div class="cart-item" data-id="${escapeHtml(item.productId)}">
        <img class="cart-item__media" src="${escapeHtml(image)}" alt="${escapeHtml(
        item.name
      )}" data-fallback="${escapeHtml(item.name.slice(0, 10))}">
        <div>
          <a class="cart-item__name" href="product-detail.html?id=${escapeHtml(
            item.productId
          )}">${escapeHtml(item.name)}</a>
          <div class="text-muted" style="font-size:var(--fs-sm)">${formatCurrency(
            item.price
          )}</div>
          <div class="cart-item__row">
            <div class="qty">
              <button class="qty__btn" type="button" data-action="dec" aria-label="Giảm">−</button>
              <input class="qty__input" type="number" min="1" max="${MAX_QTY}"
                value="${item.quantity}" data-action="input" aria-label="Số lượng">
              <button class="qty__btn" type="button" data-action="inc" aria-label="Tăng">+</button>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-action="remove">Xoá</button>
            <span class="cart-item__price">${formatCurrency(
              item.price * item.quantity
            )}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");

  bindImageFallback(listEl);

  listEl.querySelectorAll(".cart-item").forEach((row) => {
    const productId = row.dataset.id;
    const input = row.querySelector('[data-action="input"]');
    row.querySelector('[data-action="dec"]')?.addEventListener("click", () => {
      setQuantity(productId, Number(input.value) - 1);
    });
    row.querySelector('[data-action="inc"]')?.addEventListener("click", () => {
      setQuantity(productId, Number(input.value) + 1);
    });
    input?.addEventListener("change", () => {
      setQuantity(productId, Number(input.value));
    });
    row.querySelector('[data-action="remove"]')?.addEventListener("click", async () => {
      const ok = await confirmAction("Xoá sản phẩm này khỏi giỏ hàng?", {
        title: "Xoá sản phẩm",
        confirmText: "Xoá",
        danger: true,
      });
      if (ok) removeItem(productId);
    });
  });
}

/**
 * Render khối tổng tiền của giỏ hàng.
 * @param {HTMLElement} summaryEl
 * @param {Array<object>} items
 */
function renderCartSummary(summaryEl, items) {
  const { count, subtotal, shipping, total } = cartTotals(items);
  summaryEl.innerHTML = `
    <h2 class="panel__title">Tóm tắt đơn hàng</h2>
    <div class="summary-row"><span>Số sản phẩm</span><strong>${count}</strong></div>
    <div class="summary-row"><span>Tạm tính</span><strong>${formatCurrency(
      subtotal
    )}</strong></div>
    <div class="summary-row"><span>Phí vận chuyển</span><strong>${
      shipping === 0 ? "Miễn phí" : formatCurrency(shipping)
    }</strong></div>
    <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(
      total
    )}</span></div>
    <a class="btn btn--block btn--lg ${
      count === 0 ? "btn--outline" : ""
    }" href="checkout.html" ${count === 0 ? 'aria-disabled="true"' : ""}>Thanh toán</a>
    <p class="form-note text-center" style="margin-top:var(--space-3)">
      Miễn phí vận chuyển cho đơn từ ${formatCurrency(1_000_000)}.
    </p>`;
}
