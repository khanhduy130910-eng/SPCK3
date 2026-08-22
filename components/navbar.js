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
 * Chuẩn hóa tên danh mục để so khớp an toàn khi có dấu tiếng Việt.
 * Ví dụ: "Nữ" và "Nữ" vẫn được xem là cùng một giá trị sau khi chuẩn hóa.
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeNavCategory(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

/**
 * Xác định link nav nào đang được chọn dựa trên pathname + query string hiện tại.
 * Điều này tránh bug khi nhiều link cùng đi tới cùng file nhưng khác category.
 * @param {string} href
 * @returns {boolean}
 */
export function isActiveNavLink(href) {
  const currentUrl = new URL(location.href);
  const currentPath = currentUrl.pathname.split("/").pop() || "index.html";
  const currentCategory = currentUrl.searchParams.get("category");

  const targetUrl = new URL(href, location.href);
  const targetPath = targetUrl.pathname.split("/").pop() || "index.html";
  const targetCategory = targetUrl.searchParams.get("category");

  if (targetPath !== currentPath) return false;

  // Link category như "Nữ" / "Nam" / "Phụ kiện" chỉ active khi query category
  // khớp chính xác với URL hiện tại; link "Sản phẩm" chỉ active khi không có category.
  if (targetCategory) {
    return !!currentCategory && normalizeNavCategory(targetCategory) === normalizeNavCategory(currentCategory);
  }

  return !currentCategory;
}

/**
 * HTML cho thanh nav desktop.
 * @returns {string}
 */
export function navHtml() {
  return `<nav class="nav" aria-label="Điều hướng chính">
    ${NAV_LINKS.map((link) => {
      const isActive = isActiveNavLink(link.href);
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
