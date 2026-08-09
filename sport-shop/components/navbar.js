// ==========================================================================
// NAVBAR.JS
// Component điều hướng: danh sách link chính, thanh nav desktop và drawer mobile.
//
// File này làm gì:
//   - NAV_LINKS: nguồn dữ liệu duy nhất cho menu.
//   - navHtml(): thanh nav cho desktop.
//   - drawerHtml(): nội dung drawer cho mobile.
//   - initDrawer(): mở/đóng drawer.
// File nào sử dụng nó: components/header.js
// Firebase service được sử dụng: không.
// ==========================================================================

import { escapeHtml } from "../js/utils.js";

/** Các link điều hướng chính của storefront. */
export const NAV_LINKS = [
  { label: "Trang chủ", href: "index.html" },
  { label: "Sản phẩm", href: "products.html" },
  { label: "Nam", href: "products.html?category=Nam" },
  { label: "Nữ", href: "products.html?category=N%E1%BB%AF" },
  { label: "Phụ kiện", href: "products.html?category=Ph%E1%BB%A5%20ki%E1%BB%87n" },
];

/**
 * Tên file HTML của trang hiện tại, ví dụ "products.html".
 * @returns {string}
 */
export function currentPage() {
  const file = location.pathname.split("/").pop();
  return file && file.length ? file : "index.html";
}

/**
 * HTML cho thanh nav desktop.
 * @returns {string}
 */
export function navHtml() {
  const page = currentPage();
  return `<nav class="nav" aria-label="Điều hướng chính">
    ${NAV_LINKS.map((link) => {
      const isActive = link.href.split("?")[0] === page && !link.href.includes("?");
      return `<a class="nav__link ${isActive ? "is-active" : ""}" href="${escapeHtml(
        link.href
      )}">${escapeHtml(link.label)}</a>`;
    }).join("")}
  </nav>`;
}

/**
 * HTML cho drawer mobile (menu + link tài khoản).
 * @returns {string}
 */
export function drawerHtml() {
  return `
    <div class="drawer-backdrop" data-drawer-backdrop></div>
    <aside class="drawer" data-drawer aria-label="Menu di động">
      <div class="drawer__head">
        <span class="logo">SPORT<span>HUB</span></span>
        <button class="icon-btn" type="button" data-drawer-close aria-label="Đóng menu">✕</button>
      </div>
      <div class="field">
        <input class="input" type="search" placeholder="Tìm sản phẩm..." data-drawer-search
          aria-label="Tìm sản phẩm">
      </div>
      ${NAV_LINKS.map(
        (link) =>
          `<a class="drawer__link" href="${escapeHtml(link.href)}">${escapeHtml(
            link.label
          )}</a>`
      ).join("")}
      <a class="drawer__link" href="cart.html">Giỏ hàng</a>
      <a class="drawer__link" href="orders.html">Đơn hàng</a>
      <a class="drawer__link" href="profile.html">Hồ sơ</a>
      <a class="drawer__link hidden" href="admin.html" data-drawer-admin>Quản trị</a>
      <div data-drawer-auth></div>
    </aside>`;
}

/**
 * Gắn sự kiện mở/đóng drawer mobile.
 * @param {HTMLElement} root phần tử chứa header + drawer
 */
export function initDrawer(root) {
  const drawer = root.querySelector("[data-drawer]");
  const backdrop = root.querySelector("[data-drawer-backdrop]");
  const toggle = root.querySelector("[data-menu-toggle]");
  if (!drawer || !backdrop) return;

  const open = () => {
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.classList.add("no-scroll");
  };
  const close = () => {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  };

  toggle?.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  drawer.querySelector("[data-drawer-close]")?.addEventListener("click", close);
  drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  // Ô tìm kiếm trong drawer: Enter để sang trang sản phẩm với query.
  drawer.querySelector("[data-drawer-search]")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const keyword = event.currentTarget.value.trim();
    location.href = keyword
      ? `products.html?q=${encodeURIComponent(keyword)}`
      : "products.html";
  });
}
