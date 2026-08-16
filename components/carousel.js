// ==========================================================================
// CAROUSEL.JS
// Carousel khuyến mãi ngay dưới hero banner của trang chủ.
//
// File này làm gì:
//   - Render 4 slide (Bộ sưu tập mới / Giảm giá 50% / Bán chạy / Ưu đãi thành viên).
//   - Tự chuyển slide sau mỗi 4 giây, tạm dừng khi hover hoặc khi focus.
//   - Có nút prev/next, dots, hỗ trợ bàn phím và swipe trên mobile.
//
// File nào sử dụng nó: js/main.js (index.html)
// Firebase service được sử dụng: không.
// ==========================================================================

import { escapeHtml, bindImageFallback } from "../js/utils.js";

/** Thời gian tự chuyển slide (ms). */
const AUTOPLAY_MS = 4000;

/** Nội dung 4 slide. */
const SLIDES = [
  {
    eyebrow: "Mùa mới",
    title: "Bộ sưu tập mới",
    text: "Giày chạy, áo tập và phụ kiện vừa lên kệ tuần này.",
    ctaText: "Xem bộ sưu tập",
    ctaHref: "products.html?sort=newest",
    image:
      "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    eyebrow: "Flash sale",
    title: "Giảm giá đến 50%",
    text: "Hàng nghìn sản phẩm thể thao giảm sâu, số lượng có hạn.",
    ctaText: "Mua ngay",
    ctaHref: "products.html?sort=price-asc",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=80",
  },
  {
    eyebrow: "Best seller",
    title: "Sản phẩm bán chạy",
    text: "Những mẫu được khách hàng SPORTHUB chọn nhiều nhất.",
    ctaText: "Xem hàng bán chạy",
    ctaHref: "products.html",
    image:
      "https://images.unsplash.com/photo-1517343985841-f8b2d66e010b?auto=format&fit=crop&w=1600&q=80",
  },
  {
    eyebrow: "Thành viên",
    title: "Ưu đãi thành viên",
    text: "Tạo tài khoản để nhận mã giảm giá và theo dõi đơn hàng.",
    ctaText: "Tạo tài khoản",
    ctaHref: "register.html",
    image:
      "https://images.unsplash.com/photo-1571019613576-2b22c76fd955?auto=format&fit=crop&w=1600&q=80",
  },
];

/**
 * Render + khởi tạo carousel trong container chỉ định.
 * @param {string} [containerId="promo-carousel"]
 */
export function initCarousel(containerId = "promo-carousel") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="carousel" data-carousel>
      <div class="carousel__viewport">
        <div class="carousel__track" data-track>
          ${SLIDES.map(
            (slide, index) => `
            <div class="carousel__slide" role="group" aria-roledescription="slide"
              aria-label="${index + 1} / ${SLIDES.length}: ${escapeHtml(slide.title)}">
              <img class="carousel__image" src="${escapeHtml(slide.image)}"
                alt="${escapeHtml(slide.title)}" loading="${index === 0 ? "eager" : "lazy"}"
                data-fallback="${escapeHtml(slide.title)}">
              <div class="carousel__content">
                <span class="carousel__eyebrow">${escapeHtml(slide.eyebrow)}</span>
                <h3 class="carousel__title">${escapeHtml(slide.title)}</h3>
                <p class="carousel__text">${escapeHtml(slide.text)}</p>
                <a class="btn btn--light" href="${escapeHtml(slide.ctaHref)}">${escapeHtml(
              slide.ctaText
            )}</a>
              </div>
            </div>`
          ).join("")}
        </div>
      </div>
      <button class="carousel__nav carousel__nav--prev" type="button" data-prev
        aria-label="Slide trước">‹</button>
      <button class="carousel__nav carousel__nav--next" type="button" data-next
        aria-label="Slide sau">›</button>
      <div class="carousel__dots" role="tablist" aria-label="Chọn slide">
        ${SLIDES.map(
          (slide, index) =>
            `<button class="carousel__dot" type="button" role="tab" data-dot="${index}"
              aria-label="${escapeHtml(slide.title)}"></button>`
        ).join("")}
      </div>
    </div>`;

  bindImageFallback(container);

  const root = container.querySelector("[data-carousel]");
  const track = container.querySelector("[data-track]");
  const dots = Array.from(container.querySelectorAll("[data-dot]"));
  let index = 0;
  let timer = null;

  const paint = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === index;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-selected", String(isActive));
    });
  };

  const goTo = (next) => {
    index = (next + SLIDES.length) % SLIDES.length;
    paint();
  };

  const start = () => {
    stop();
    timer = window.setInterval(() => goTo(index + 1), AUTOPLAY_MS);
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };
  const restart = () => {
    start();
  };

  container.querySelector("[data-prev]").addEventListener("click", () => {
    goTo(index - 1);
    restart();
  });
  container.querySelector("[data-next]").addEventListener("click", () => {
    goTo(index + 1);
    restart();
  });
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goTo(Number(dot.dataset.dot));
      restart();
    });
  });

  // Tạm dừng khi người dùng đang xem/tương tác.
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  // Điều hướng bằng bàn phím khi carousel đang được focus.
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goTo(index - 1);
    if (event.key === "ArrowRight") goTo(index + 1);
  });

  // Swipe trên thiết bị cảm ứng.
  let startX = 0;
  root.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0].clientX;
      stop();
    },
    { passive: true }
  );
  root.addEventListener(
    "touchend",
    (event) => {
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) goTo(index + (delta < 0 ? 1 : -1));
      start();
    },
    { passive: true }
  );

  paint();
  start();
}
