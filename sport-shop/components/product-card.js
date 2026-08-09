// ==========================================================================
// PRODUCT-CARD.JS
// Component thẻ sản phẩm dùng chung cho trang chủ, trang sản phẩm và
// khu vực "sản phẩm liên quan".
//
// File này làm gì:
//   - productCardHtml(): sinh HTML cho một thẻ sản phẩm.
//   - renderProductGrid(): render danh sách sản phẩm vào một container và
//     gắn sự kiện "Thêm vào giỏ".
// File nào sử dụng nó: js/main.js, js/products.js, js/detail.js.
// Firebase service được sử dụng: gián tiếp qua js/cart.js (Firestore).
// ==========================================================================

import { escapeHtml, formatCurrency, placeholderImage, bindImageFallback } from "../js/utils.js";
import { addToCart } from "../js/cart.js";

/**
 * Sinh HTML một thẻ sản phẩm.
 * @param {{id: string, name?: string, price?: number, image?: string, category?: string, stock?: number, featured?: boolean}} product
 * @returns {string}
 */
export function productCardHtml(product) {
  const id = escapeHtml(product.id);
  const name = escapeHtml(product.name || "Sản phẩm");
  const category = escapeHtml(product.category || "Khác");
  const stock = Number(product.stock ?? 0);
  const outOfStock = stock <= 0;
  const image = product.image || placeholderImage(product.name || "SPORT");

  let tag = "";
  if (outOfStock) {
    tag = `<span class="product-card__tag product-card__tag--out">Hết hàng</span>`;
  } else if (product.featured) {
    tag = `<span class="product-card__tag">Nổi bật</span>`;
  }

  return `<article class="product-card fade-in">
    <a class="product-card__media" href="product-detail.html?id=${id}" aria-label="${name}">
      <img src="${escapeHtml(image)}" alt="${name}" loading="lazy"
        data-fallback="${escapeHtml((product.name || "SPORT").slice(0, 12))}">
      ${tag}
    </a>
    <div class="product-card__body">
      <span class="product-card__category">${category}</span>
      <h3 class="product-card__name">
        <a href="product-detail.html?id=${id}">${name}</a>
      </h3>
      <span class="product-card__price">${formatCurrency(product.price)}</span>
      <div class="product-card__actions">
        ${
          outOfStock
            ? `<button class="btn btn--outline btn--sm btn--block" type="button" disabled>Hết hàng</button>`
            : `<button class="btn btn--sm btn--block" type="button" data-add-to-cart="${id}">Thêm vào giỏ</button>`
        }
      </div>
    </div>
  </article>`;
}

/**
 * Render một lưới sản phẩm và gắn sự kiện thêm vào giỏ.
 * @param {HTMLElement|null} container
 * @param {Array<object>} products
 */
export function renderProductGrid(container, products) {
  if (!container) return;
  container.innerHTML = products.map(productCardHtml).join("");
  bindImageFallback(container);
  bindAddToCart(container, products);
}

/**
 * Gắn handler cho tất cả nút "Thêm vào giỏ" bên trong container.
 * @param {HTMLElement} container
 * @param {Array<object>} products
 */
export function bindAddToCart(container, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  container.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      const product = byId.get(button.dataset.addToCart);
      if (!product) return;
      await addToCart(product, 1, button);
    });
  });
}
