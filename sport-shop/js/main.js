// ==========================================================================
// MAIN.JS
// Script của trang chủ (index.html).
//
// File này làm gì:
//   - Render header + footer dùng chung.
//   - Nạp danh mục từ Firestore.
//   - Nạp sản phẩm nổi bật (featured) và sản phẩm mới nhất.
//   - Khởi tạo widget thời tiết và chatbot.
//   - Có loading skeleton, empty state và error state cho từng khối.
//
// File nào sử dụng nó: index.html
// Firebase service được sử dụng: Cloud Firestore (Products, Categories),
//   Authentication (qua header), Analytics (tuỳ chọn).
// ==========================================================================

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { renderProductGrid } from "../components/product-card.js";
import { fetchCategories, fetchProducts } from "./data.js";
import { initWeather } from "./weather.js";
import { initChatbot } from "./chatbot.js";
import { loadAnalytics } from "./firebase-config.js";
import {
  escapeHtml,
  productSkeletons,
  stateBlock,
  placeholderImage,
  bindImageFallback,
  reportError,
} from "./utils.js";

/** Điểm khởi động của trang chủ. */
async function initHomePage() {
  renderHeader();
  renderFooter();
  initChatbot();
  initWeather();
  loadAnalytics();

  await Promise.all([loadCategories(), loadProducts()]);
}

/**
 * Nạp và render danh mục sản phẩm.
 */
async function loadCategories() {
  const container = document.getElementById("category-grid");
  if (!container) return;

  container.innerHTML = Array.from({ length: 4 })
    .map(() => `<div class="skeleton category-card"></div>`)
    .join("");

  try {
    const categories = await fetchCategories();
    if (!categories.length) {
      container.innerHTML = stateBlock({
        title: "Chưa có danh mục",
        text: "Hãy thêm danh mục trong trang quản trị (Admin → Categories).",
      });
      return;
    }
    container.innerHTML = categories
      .slice(0, 8)
      .map((category) => {
        const name = escapeHtml(category.name || "Danh mục");
        const image = category.image || placeholderImage(category.name || "SPORT");
        return `<a class="category-card fade-in" href="products.html?category=${encodeURIComponent(
          category.name || ""
        )}">
          <img src="${escapeHtml(image)}" alt="${name}" loading="lazy"
            data-fallback="${name}">
          <span class="category-card__label">${name}</span>
        </a>`;
      })
      .join("");
    bindImageFallback(container);
  } catch (error) {
    reportError("home/categories", error, { silent: true });
    container.innerHTML = stateBlock({
      title: "Không tải được danh mục",
      text: "Kiểm tra kết nối mạng hoặc Firestore Security Rules.",
      type: "error",
    });
  }
}

/**
 * Nạp sản phẩm một lần rồi chia ra hai khối: nổi bật và mới nhất.
 */
async function loadProducts() {
  const featuredEl = document.getElementById("featured-products");
  const newestEl = document.getElementById("newest-products");
  if (featuredEl) featuredEl.innerHTML = productSkeletons(4);
  if (newestEl) newestEl.innerHTML = productSkeletons(4);

  try {
    const products = await fetchProducts({ limit: 48 });

    if (featuredEl) {
      const featured = products.filter((product) => product.featured).slice(0, 8);
      if (featured.length) {
        renderProductGrid(featuredEl, featured);
      } else {
        featuredEl.innerHTML = stateBlock({
          title: "Chưa có sản phẩm nổi bật",
          text: 'Bật cờ "featured" cho sản phẩm trong trang quản trị.',
          actionHtml: `<p><a class="btn btn--outline" href="products.html">Xem tất cả sản phẩm</a></p>`,
        });
      }
    }

    if (newestEl) {
      const newest = products.slice(0, 8);
      if (newest.length) {
        renderProductGrid(newestEl, newest);
      } else {
        newestEl.innerHTML = stateBlock({
          title: "Chưa có sản phẩm nào",
          text: "Thêm sản phẩm trong trang quản trị (Admin → Products), hoặc nạp dữ liệu mẫu bằng scripts/seed.html.",
        });
      }
    }
  } catch (error) {
    const message = reportError("home/products", error, { silent: true });
    const errorHtml = stateBlock({
      title: "Không tải được sản phẩm",
      text: message,
      type: "error",
    });
    if (featuredEl) featuredEl.innerHTML = errorHtml;
    if (newestEl) newestEl.innerHTML = errorHtml;
  }
}

initHomePage().catch((error) => reportError("home/init", error));
