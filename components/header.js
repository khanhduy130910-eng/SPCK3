// ==========================================================================
// HEADER.JS
// Component header dùng chung cho mọi trang storefront.
//
// File này làm gì:
//   - Render logo, navbar, ô tìm kiếm, chip thời tiết, badge giỏ hàng, menu tài khoản.
//   - Cập nhật badge giỏ hàng REALTIME theo Firestore.
//   - Hiện avatar/tên khi đã đăng nhập, hiện link Đăng nhập khi chưa.
//   - Hiện link "Quản trị" nếu role === "admin" (chỉ là tiện lợi UI, việc chặn
//     truy cập thật nằm ở requireAdmin() trong js/auth.js + Security Rules).
//
// File nào sử dụng nó: index.html, products.html, product-detail.html,
//   cart.html, checkout.html, orders.html, profile.html, 404.html
//
// Firebase service được sử dụng: Authentication (trạng thái đăng nhập) và
//   Cloud Firestore (giỏ hàng realtime).
// ==========================================================================

import { escapeHtml, getInitials, getUrlParams, showToast } from "../js/utils.js";
import { onUserChanged, logout } from "../js/auth.js";
import { subscribeCart, cartTotals } from "../js/cart.js";
import { navHtml, drawerHtml, initDrawer } from "./navbar.js";
import { initWeather } from "../js/weather.js";

/**
 * Render header vào phần tử #site-header và gắn toàn bộ sự kiện.
 * Gọi hàm này một lần trên mỗi trang (thường trong js/main.js hoặc script trang).
 * @returns {HTMLElement|null}
 */
export function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return null;

  const params = getUrlParams();
  mount.innerHTML = `
    <header class="site-header">
      <div class="container site-header__inner">
        <button class="icon-btn menu-toggle" type="button" data-menu-toggle aria-label="Mở menu">☰</button>
        <a class="logo" href="index.html">SPORT<span>HUB</span></a>
        ${navHtml()}
        <div class="header-actions">
          <form class="search" role="search" data-search-form>
            <input class="input" type="search" name="q" placeholder="Tìm sản phẩm..."
              value="${escapeHtml(params.q || "")}" aria-label="Tìm sản phẩm">
            <button class="search__btn" type="submit" aria-label="Tìm">🔍</button>
          </form>
          <div class="header-weather" id="weather-widget"></div>
          <a class="icon-btn" href="cart.html" aria-label="Giỏ hàng">
            🛒<span class="badge hidden" data-cart-badge>0</span>
          </a>
          <div class="dropdown" data-account>
            <button class="icon-btn" type="button" data-account-toggle aria-label="Tài khoản"
              aria-haspopup="true" aria-expanded="false">
              <span data-account-avatar>👤</span>
            </button>
            <div class="dropdown__menu" data-account-menu></div>
          </div>
        </div>
      </div>
    </header>
    ${drawerHtml()}`;

  initDrawer(mount);
  initSearch(mount);
  initAccount(mount);
  initCartBadge(mount);
  showPendingNotice();
  initStickyHeader(mount);
  // Thời tiết nằm ở góc phải header nên khởi tạo ngay tại đây.
  initWeather("weather-widget");
  return mount;
}

/**
 * Thêm class khi cuộn để header đổ bóng và đậm hơn (vẫn sticky từ đầu).
 * @param {HTMLElement} root
 */
function initStickyHeader(root) {
  const header = root.querySelector(".site-header");
  if (!header) return;
  const sync = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

/**
 * Ô tìm kiếm: submit sẽ điều hướng sang products.html?q=...
 * @param {HTMLElement} root
 */
function initSearch(root) {
  root.querySelector("[data-search-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const keyword = new FormData(event.currentTarget).get("q");
    const value = String(keyword || "").trim();
    location.href = value
      ? `products.html?q=${encodeURIComponent(value)}`
      : "products.html";
  });
}

/**
 * Menu tài khoản: đóng/mở dropdown, render nội dung theo trạng thái đăng nhập.
 * @param {HTMLElement} root
 */
function initAccount(root) {
  const dropdown = root.querySelector("[data-account]");
  const toggle = root.querySelector("[data-account-toggle]");
  const menu = root.querySelector("[data-account-menu]");
  const avatarSlot = root.querySelector("[data-account-avatar]");
  const drawerAdmin = root.querySelector("[data-drawer-admin]");
  const drawerAuth = root.querySelector("[data-drawer-auth]");
  if (!dropdown || !toggle || !menu) return;

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = dropdown.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  onUserChanged((user, profile) => {
    if (!user) {
      avatarSlot.textContent = "👤";
      menu.innerHTML = `
        <a class="dropdown__item" href="login.html">Đăng nhập</a>
        <a class="dropdown__item" href="register.html">Tạo tài khoản</a>`;
      drawerAdmin?.classList.add("hidden");
      if (drawerAuth) {
        drawerAuth.innerHTML = `<a class="drawer__link" href="login.html">Đăng nhập</a>`;
      }
      return;
    }

    const name = profile?.name || user.displayName || "Khách";
    const avatar = profile?.avatar || user.photoURL || "";
    avatarSlot.innerHTML = avatar
      ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">`
      : `<span class="avatar avatar--initials">${escapeHtml(getInitials(name))}</span>`;

    const isAdminUser = profile?.role === "admin";
    menu.innerHTML = `
      <div class="dropdown__header">
        <div class="dropdown__name">${escapeHtml(name)}</div>
        <div class="dropdown__email">${escapeHtml(user.email || "")}</div>
      </div>
      <a class="dropdown__item" href="profile.html">Hồ sơ của tôi</a>
      <a class="dropdown__item" href="orders.html">Đơn hàng của tôi</a>
      <a class="dropdown__item" href="cart.html">Giỏ hàng</a>
      ${isAdminUser ? `<a class="dropdown__item" href="admin.html">Trang quản trị</a>` : ""}
      <button class="dropdown__item dropdown__item--danger" type="button" data-logout>Đăng xuất</button>`;

    drawerAdmin?.classList.toggle("hidden", !isAdminUser);
    if (drawerAuth) {
      drawerAuth.innerHTML = `<button class="drawer__link" type="button" data-logout style="width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--color-gray-200)">Đăng xuất</button>`;
    }

    root.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await logout();
          showToast("Đã đăng xuất.", "success");
          setTimeout(() => {
            location.href = "index.html";
          }, 400);
        } catch (error) {
          console.error("[header] logout", error);
          showToast("Không đăng xuất được. Vui lòng thử lại.", "error");
        }
      });
    });
  });
}

/**
 * Badge giỏ hàng: cập nhật realtime từ Firestore Carts/{uid}.
 * @param {HTMLElement} root
 */
function initCartBadge(root) {
  const badge = root.querySelector("[data-cart-badge]");
  if (!badge) return;
  subscribeCart((items) => {
    const { count } = cartTotals(items);
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.toggle("hidden", count === 0);
  });
}

/**
 * Hiển thị thông báo được lưu tạm bởi trang trước (ví dụ bị chặn vào admin).
 */
function showPendingNotice() {
  const notice = sessionStorage.getItem("authNotice");
  if (notice) {
    sessionStorage.removeItem("authNotice");
    showToast(notice, "warning", 4200);
  }
}
