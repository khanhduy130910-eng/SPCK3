// ==========================================================================
// DETAIL.JS
// Script của trang chi tiết sản phẩm (product-detail.html?id=PRODUCT_ID).
//
// File này làm gì:
//   - Lấy product id từ URL rồi đọc document Products/{id}.
//   - Render ảnh chính + gallery, tên, giá, mô tả, tồn kho, danh mục, thông số.
//   - Đánh giá: hiển thị danh sách và cho người đã đăng nhập gửi đánh giá.
//   - Sản phẩm liên quan (cùng danh mục).
//   - Add to cart / Buy now; nếu hết hàng thì chặn và hiển thị "Hết hàng".
//
// File nào sử dụng nó: product-detail.html
// Firebase service được sử dụng: Cloud Firestore (Products, Reviews, Carts),
//   Authentication.
// ==========================================================================

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { renderProductGrid } from "../components/product-card.js";
import {
  averageRating,
  createReview,
  fetchProductById,
  fetchProducts,
  fetchReviews,
} from "./data.js";
import { addToCart } from "./cart.js";
import { getCurrentProfile, getCurrentUser, onUserChanged } from "./auth.js";
import { initChatbot } from "./chatbot.js";
import {
  bindImageFallback,
  clamp,
  escapeHtml,
  formatCurrency,
  formatDate,
  getUrlParams,
  placeholderImage,
  productSkeletons,
  reportError,
  setButtonLoading,
  showToast,
  stateBlock,
} from "./utils.js";

/** Sản phẩm đang xem. */
let product = null;

/** Điểm khởi động của trang chi tiết. */
async function initDetailPage() {
  renderHeader();
  renderFooter();
  initChatbot();

  const { id } = getUrlParams();
  const container = document.getElementById("detail-root");
  if (!container) return;

  if (!id) {
    container.innerHTML = stateBlock({
      title: "Thiếu mã sản phẩm",
      text: "URL cần có dạng product-detail.html?id=PRODUCT_ID.",
      type: "error",
      actionHtml: `<p><a class="btn" href="products.html">Xem tất cả sản phẩm</a></p>`,
    });
    return;
  }

  container.innerHTML = `<div class="detail">
    <div><div class="skeleton gallery__main"></div></div>
    <div>
      <div class="skeleton skeleton-line skeleton-line--sm"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
    </div>
  </div>`;

  try {
    product = await fetchProductById(id);
  } catch (error) {
    const message = reportError("detail/fetch", error, { silent: true });
    container.innerHTML = stateBlock({
      title: "Không tải được sản phẩm",
      text: message,
      type: "error",
    });
    return;
  }

  if (!product || product.active === false) {
    container.innerHTML = stateBlock({
      title: "Sản phẩm không tồn tại",
      text: "Sản phẩm có thể đã bị xoá hoặc đang tắt hiển thị.",
      actionHtml: `<p><a class="btn" href="products.html">Xem sản phẩm khác</a></p>`,
    });
    return;
  }

  document.title = `${product.name} · SPORTHUB`;
  renderDetail(container, product);
  await Promise.all([loadReviews(product.id), loadRelated(product)]);
}

/**
 * Render toàn bộ khối chi tiết sản phẩm.
 * @param {HTMLElement} container
 * @param {object} item
 */
function renderDetail(container, item) {
  const images = item.images.length ? item.images : [placeholderImage(item.name)];
  const outOfStock = item.stock <= 0;
  const specRows = Object.entries(item.specs || {});

  container.innerHTML = `
    <nav class="breadcrumb">
      <a href="index.html">Trang chủ</a><span>/</span>
      <a href="products.html">Sản phẩm</a><span>/</span>
      <a href="products.html?category=${encodeURIComponent(item.category)}">${escapeHtml(
    item.category
  )}</a><span>/</span>
      <span>${escapeHtml(item.name)}</span>
    </nav>
    <div class="detail">
      <div class="gallery">
        <div class="gallery__main">
          <img id="gallery-main-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(
    item.name
  )}" data-fallback="${escapeHtml(item.name.slice(0, 12))}">
        </div>
        ${
          images.length > 1
            ? `<div class="gallery__thumbs">${images
                .map(
                  (source, index) =>
                    `<button class="gallery__thumb ${
                      index === 0 ? "is-active" : ""
                    }" type="button" data-src="${escapeHtml(source)}">
                      <img src="${escapeHtml(source)}" alt="Ảnh ${index + 1}"
                        data-fallback="${escapeHtml(item.name.slice(0, 8))}">
                    </button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <div>
        <span class="product-card__category">${escapeHtml(item.category)}</span>
        <h1>${escapeHtml(item.name)}</h1>
        <div id="detail-rating" class="stars" style="margin-bottom:var(--space-2)"></div>
        <div class="detail__price">${formatCurrency(item.price)}</div>
        <div class="detail__meta">
          <span>${
            outOfStock
              ? '<strong style="color:var(--color-danger)">Hết hàng</strong>'
              : `Còn <strong>${item.stock}</strong> sản phẩm`
          }</span>
          <span>Mã: <strong>${escapeHtml(item.id.slice(0, 8).toUpperCase())}</strong></span>
        </div>
        <p>${escapeHtml(item.description || "Sản phẩm chưa có mô tả.")}</p>
        <div class="detail__actions">
          <div class="qty">
            <button class="qty__btn" type="button" id="qty-dec" aria-label="Giảm">−</button>
            <input class="qty__input" id="qty-input" type="number" min="1" max="${Math.max(
              1,
              item.stock
            )}" value="1" aria-label="Số lượng" ${outOfStock ? "disabled" : ""}>
            <button class="qty__btn" type="button" id="qty-inc" aria-label="Tăng">+</button>
          </div>
          ${
            outOfStock
              ? `<button class="btn btn--outline btn--lg" type="button" disabled>Hết hàng</button>`
              : `<button class="btn btn--lg" type="button" id="add-to-cart">Thêm vào giỏ</button>
                 <button class="btn btn--outline btn--lg" type="button" id="buy-now">Mua ngay</button>`
          }
        </div>

        <div class="tabs" role="tablist">
          <button class="tabs__btn is-active" type="button" data-tab="specs">Thông số</button>
          <button class="tabs__btn" type="button" data-tab="reviews">Đánh giá</button>
        </div>
        <div data-tab-panel="specs">
          ${
            specRows.length
              ? `<table class="specs"><tbody>${specRows
                  .map(
                    ([key, value]) =>
                      `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`
                  )
                  .join("")}</tbody></table>`
              : `<p class="text-muted">Sản phẩm chưa có thông số chi tiết.</p>`
          }
        </div>
        <div data-tab-panel="reviews" class="hidden">
          <div id="review-form-slot"></div>
          <div id="review-list"><span class="spinner"></span> Đang tải đánh giá...</div>
        </div>
      </div>
    </div>
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Sản phẩm liên quan</h2>
        <a class="section__link" href="products.html?category=${encodeURIComponent(
          item.category
        )}">Xem thêm</a>
      </div>
      <div class="product-grid" id="related-products">${productSkeletons(4)}</div>
    </section>`;

  bindImageFallback(container);
  bindGallery(container);
  bindTabs(container);
  bindQuantityAndCart(container, item);
}

/** Gallery: click thumbnail để đổi ảnh chính. */
function bindGallery(container) {
  const main = container.querySelector("#gallery-main-img");
  container.querySelectorAll(".gallery__thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      if (main) main.src = thumb.dataset.src;
      container
        .querySelectorAll(".gallery__thumb")
        .forEach((element) => element.classList.remove("is-active"));
      thumb.classList.add("is-active");
    });
  });
}

/** Tabs Thông số / Đánh giá. */
function bindTabs(container) {
  container.querySelectorAll(".tabs__btn").forEach((button) => {
    button.addEventListener("click", () => {
      container
        .querySelectorAll(".tabs__btn")
        .forEach((element) => element.classList.remove("is-active"));
      button.classList.add("is-active");
      container.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.tabPanel !== button.dataset.tab);
      });
    });
  });
}

/**
 * Bộ chọn số lượng + nút thêm vào giỏ / mua ngay.
 * @param {HTMLElement} container
 * @param {object} item
 */
function bindQuantityAndCart(container, item) {
  const input = container.querySelector("#qty-input");
  const readQty = () => clamp(Number(input?.value) || 1, 1, Math.max(1, item.stock));

  container.querySelector("#qty-dec")?.addEventListener("click", () => {
    input.value = String(clamp(readQty() - 1, 1, Math.max(1, item.stock)));
  });
  container.querySelector("#qty-inc")?.addEventListener("click", () => {
    input.value = String(clamp(readQty() + 1, 1, Math.max(1, item.stock)));
  });
  input?.addEventListener("change", () => {
    input.value = String(readQty());
  });

  container.querySelector("#add-to-cart")?.addEventListener("click", async (event) => {
    await addToCart(item, readQty(), event.currentTarget);
  });

  container.querySelector("#buy-now")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const added = await addToCart(item, readQty(), button);
    if (added) {
      setButtonLoading(button, true, "Đang chuyển...");
      location.href = "checkout.html";
    }
  });
}

/**
 * Nạp và render danh sách đánh giá + form gửi đánh giá.
 * @param {string} productId
 */
async function loadReviews(productId) {
  const listEl = document.getElementById("review-list");
  const ratingEl = document.getElementById("detail-rating");
  if (!listEl) return;

  try {
    const reviews = await fetchReviews(productId);
    const { average, count } = averageRating(reviews);
    if (ratingEl) {
      ratingEl.innerHTML = count
        ? `${starsHtml(average)} <span class="text-muted" style="font-size:var(--fs-sm)">${average}/5 · ${count} đánh giá</span>`
        : `<span class="text-muted" style="font-size:var(--fs-sm)">Chưa có đánh giá</span>`;
    }

    listEl.innerHTML = reviews.length
      ? reviews
          .map(
            (review) => `<div class="review">
              <div class="review__head">
                <span class="review__author">${escapeHtml(review.userName || "Khách")}</span>
                <span class="stars">${starsHtml(review.rating)}</span>
                <span class="text-muted" style="font-size:var(--fs-xs);margin-left:auto">${formatDate(
                  review.createdAt
                )}</span>
              </div>
              <p style="margin:0">${escapeHtml(review.comment || "")}</p>
            </div>`
          )
          .join("")
      : `<p class="text-muted">Chưa có đánh giá nào cho sản phẩm này.</p>`;

    renderReviewForm(productId);
  } catch (error) {
    reportError("detail/reviews", error, { silent: true });
    listEl.innerHTML = `<p class="text-muted">Không tải được đánh giá.</p>`;
  }
}

/**
 * Render form gửi đánh giá (chỉ khi đã đăng nhập).
 * @param {string} productId
 */
function renderReviewForm(productId) {
  const slot = document.getElementById("review-form-slot");
  if (!slot) return;

  onUserChanged((user) => {
    if (!user) {
      slot.innerHTML = `<p class="text-muted"><a href="login.html?redirect=${encodeURIComponent(
        `product-detail.html?id=${productId}`
      )}">Đăng nhập</a> để viết đánh giá.</p>`;
      return;
    }
    slot.innerHTML = `
      <form class="panel" id="review-form" style="margin-bottom:var(--space-4)">
        <div class="field">
          <span class="field__label">Chấm điểm</span>
          <div class="rating-input" id="rating-input">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) =>
                  `<button type="button" data-value="${value}" class="${
                    value <= 5 ? "is-on" : ""
                  }" aria-label="${value} sao">★</button>`
              )
              .join("")}
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="review-comment">Nhận xét</label>
          <textarea class="textarea" id="review-comment" maxlength="1000"
            placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..." required></textarea>
        </div>
        <button class="btn" type="submit">Gửi đánh giá</button>
      </form>`;

    let rating = 5;
    const stars = slot.querySelectorAll("#rating-input button");
    const paint = () => {
      stars.forEach((star) => {
        star.classList.toggle("is-on", Number(star.dataset.value) <= rating);
      });
    };
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        rating = Number(star.dataset.value);
        paint();
      });
    });
    paint();

    slot.querySelector("#review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const comment = slot.querySelector("#review-comment").value.trim();
      if (!comment) {
        showToast("Vui lòng nhập nhận xét.", "warning");
        return;
      }
      setButtonLoading(button, true, "Đang gửi...");
      try {
        await createReview({
          productId,
          uid: getCurrentUser().uid,
          userName: getCurrentProfile()?.name || getCurrentUser().displayName || "Khách",
          rating,
          comment,
        });
        showToast("Cảm ơn bạn đã đánh giá!", "success");
        await loadReviews(productId);
      } catch (error) {
        reportError("detail/createReview", error);
      } finally {
        setButtonLoading(button, false);
      }
    });
  });
}

/**
 * Nạp sản phẩm liên quan (cùng danh mục, loại bỏ chính nó).
 * @param {object} item
 */
async function loadRelated(item) {
  const container = document.getElementById("related-products");
  if (!container) return;
  try {
    const products = await fetchProducts({ limit: 48 });
    let related = products.filter(
      (candidate) => candidate.id !== item.id && candidate.category === item.category
    );
    if (!related.length) {
      related = products.filter((candidate) => candidate.id !== item.id);
    }
    if (!related.length) {
      container.innerHTML = `<p class="text-muted">Chưa có sản phẩm liên quan.</p>`;
      return;
    }
    renderProductGrid(container, related.slice(0, 4));
  } catch (error) {
    reportError("detail/related", error, { silent: true });
    container.innerHTML = `<p class="text-muted">Không tải được sản phẩm liên quan.</p>`;
  }
}

/**
 * Sinh chuỗi sao từ điểm đánh giá.
 * @param {number} value
 * @returns {string}
 */
function starsHtml(value) {
  const filled = Math.round(Number(value) || 0);
  return "★".repeat(clamp(filled, 0, 5)) + "☆".repeat(5 - clamp(filled, 0, 5));
}

initDetailPage().catch((error) => reportError("detail/init", error));
