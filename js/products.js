// ==========================================================================
// PRODUCTS.JS
// Script của trang danh sách sản phẩm (products.html).
//
// File này làm gì:
//   - Nạp toàn bộ sản phẩm active từ Firestore một lần.
//   - Tìm kiếm theo tên/mô tả, lọc theo danh mục, lọc theo khoảng giá.
//   - Sắp xếp: giá tăng, giá giảm, mới nhất, tên A-Z.
//   - Phân trang phía client.
//   - Loading skeleton, empty state, error state.
//   - Đồng bộ trạng thái filter vào URL để có thể chia sẻ link.
//
// File nào sử dụng nó: products.html
// Firebase service được sử dụng: Cloud Firestore (Products, Categories).
// ==========================================================================

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { renderProductGrid } from "../components/product-card.js";
import { renderPagination, paginate } from "../components/pagination.js";
import { fetchCategories, fetchProducts } from "./data.js";
import { initChatbot } from "./chatbot.js";
import {
  debounce,
  escapeHtml,
  getUrlParams,
  productSkeletons,
  stateBlock,
  reportError,
  toDate,
} from "./utils.js";

const PAGE_SIZE = 12;

/** Toàn bộ sản phẩm đã tải (nguồn dữ liệu để lọc ở client). */
let allProducts = [];

/** Trạng thái filter hiện tại. */
const state = {
  keyword: "",
  categories: new Set(),
  minPrice: null,
  maxPrice: null,
  sort: "newest",
  featuredOnly: false,
  page: 1,
};

const dom = {};

/** Điểm khởi động của trang sản phẩm. */
async function initProductsPage() {
  renderHeader();
  renderFooter();
  initChatbot();

  dom.grid = document.getElementById("product-grid");
  dom.count = document.getElementById("result-count");
  dom.pagination = document.getElementById("pagination");
  dom.search = document.getElementById("filter-search");
  dom.categoryList = document.getElementById("filter-categories");
  dom.minPrice = document.getElementById("filter-min");
  dom.maxPrice = document.getElementById("filter-max");
  dom.sort = document.getElementById("filter-sort");
  dom.featured = document.getElementById("filter-featured");
  dom.reset = document.getElementById("filter-reset");
  dom.title = document.getElementById("page-title");

  readUrlParams();
  bindEvents();

  dom.grid.innerHTML = productSkeletons(PAGE_SIZE);

  await Promise.all([loadCategoryFilter(), loadAllProducts()]);
}

/** Đọc query string để khôi phục filter (?q=, ?category=, ?sort=, ?featured=). */
function readUrlParams() {
  const params = getUrlParams();
  if (params.q) {
    state.keyword = params.q;
    if (dom.search) dom.search.value = params.q;
  }
  if (params.category) {
    state.categories.add(params.category);
    if (dom.title) dom.title.textContent = params.category;
  }
  if (params.sort) {
    state.sort = params.sort;
    if (dom.sort) dom.sort.value = params.sort;
  }
  if (params.featured === "1") {
    state.featuredOnly = true;
    if (dom.featured) dom.featured.checked = true;
  }
}

/** Ghi trạng thái filter vào URL (không reload trang). */
function syncUrl() {
  const params = new URLSearchParams();
  if (state.keyword) params.set("q", state.keyword);
  const [firstCategory] = [...state.categories];
  if (state.categories.size === 1 && firstCategory) params.set("category", firstCategory);
  if (state.sort && state.sort !== "newest") params.set("sort", state.sort);
  if (state.featuredOnly) params.set("featured", "1");
  const querystring = params.toString();
  history.replaceState(null, "", querystring ? `?${querystring}` : location.pathname);
}

/** Gắn sự kiện cho toàn bộ control filter. */
function bindEvents() {
  dom.search?.addEventListener(
    "input",
    debounce((event) => {
      state.keyword = event.target.value.trim();
      state.page = 1;
      applyFilters();
    }, 300)
  );

  const onPriceChange = debounce(() => {
    state.minPrice = parseNumber(dom.minPrice?.value);
    state.maxPrice = parseNumber(dom.maxPrice?.value);
    state.page = 1;
    applyFilters();
  }, 400);
  dom.minPrice?.addEventListener("input", onPriceChange);
  dom.maxPrice?.addEventListener("input", onPriceChange);

  dom.sort?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    applyFilters();
  });

  dom.featured?.addEventListener("change", (event) => {
    state.featuredOnly = event.target.checked;
    state.page = 1;
    applyFilters();
  });

  dom.reset?.addEventListener("click", () => {
    state.keyword = "";
    state.categories.clear();
    state.minPrice = null;
    state.maxPrice = null;
    state.sort = "newest";
    state.featuredOnly = false;
    state.page = 1;
    if (dom.search) dom.search.value = "";
    if (dom.minPrice) dom.minPrice.value = "";
    if (dom.maxPrice) dom.maxPrice.value = "";
    if (dom.sort) dom.sort.value = "newest";
    if (dom.featured) dom.featured.checked = false;
    dom.categoryList
      ?.querySelectorAll("input[type=checkbox]")
      .forEach((checkbox) => {
        checkbox.checked = false;
      });
    if (dom.title) dom.title.textContent = "Tất cả sản phẩm";
    applyFilters();
  });
}

/**
 * Chuyển chuỗi input thành số, trả về null nếu rỗng/không hợp lệ.
 * @param {string|undefined} value
 * @returns {number|null}
 */
function parseNumber(value) {
  const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Nạp danh sách danh mục để làm checkbox filter. */
async function loadCategoryFilter() {
  if (!dom.categoryList) return;
  dom.categoryList.innerHTML = `<span class="text-muted" style="font-size:var(--fs-sm)">Đang tải...</span>`;
  try {
    const categories = await fetchCategories();
    if (!categories.length) {
      dom.categoryList.innerHTML = `<span class="text-muted" style="font-size:var(--fs-sm)">Chưa có danh mục</span>`;
      return;
    }
    dom.categoryList.innerHTML = categories
      .map((category) => {
        const name = escapeHtml(category.name || "");
        const checked = state.categories.has(category.name) ? "checked" : "";
        return `<label class="checkbox-row">
          <input type="checkbox" value="${name}" ${checked}>
          <span>${name}</span>
        </label>`;
      })
      .join("");
    dom.categoryList.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.categories.add(checkbox.value);
        else state.categories.delete(checkbox.value);
        state.page = 1;
        if (dom.title) {
          dom.title.textContent =
            state.categories.size === 1 ? [...state.categories][0] : "Tất cả sản phẩm";
        }
        applyFilters();
      });
    });
  } catch (error) {
    reportError("products/categories", error, { silent: true });
    dom.categoryList.innerHTML = `<span class="text-muted" style="font-size:var(--fs-sm)">Không tải được danh mục</span>`;
  }
}

/** Nạp toàn bộ sản phẩm active rồi render lần đầu. */
async function loadAllProducts() {
  try {
    allProducts = await fetchProducts();
    applyFilters();
  } catch (error) {
    const message = reportError("products/list", error, { silent: true });
    dom.grid.innerHTML = stateBlock({
      title: "Không tải được sản phẩm",
      text: message,
      type: "error",
      actionHtml: `<p><button class="btn btn--outline" type="button" onclick="location.reload()">Tải lại</button></p>`,
    });
    if (dom.count) dom.count.textContent = "";
  }
}

/** Áp dụng filter + sort + phân trang rồi render. */
function applyFilters() {
  const keyword = state.keyword.toLowerCase();
  let result = allProducts.filter((product) => {
    if (state.featuredOnly && !product.featured) return false;
    if (state.categories.size && !state.categories.has(product.category)) return false;
    if (state.minPrice !== null && product.price < state.minPrice) return false;
    if (state.maxPrice !== null && product.price > state.maxPrice) return false;
    if (keyword) {
      const haystack = `${product.name} ${product.description} ${product.category}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  result = sortProducts(result, state.sort);
  syncUrl();
  renderResults(result);
}

/**
 * Sắp xếp danh sách sản phẩm.
 * @param {Array<object>} products
 * @param {string} sort
 * @returns {Array<object>}
 */
function sortProducts(products, sort) {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    case "newest":
    default:
      return list.sort(
        (a, b) =>
          (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)
      );
  }
}

/**
 * Render lưới sản phẩm + đếm kết quả + phân trang.
 * @param {Array<object>} products
 */
function renderResults(products) {
  if (dom.count) {
    dom.count.textContent = products.length
      ? `${products.length} sản phẩm`
      : "Không có sản phẩm phù hợp";
  }

  if (!products.length) {
    dom.grid.innerHTML = stateBlock({
      title: "Không tìm thấy sản phẩm",
      text: "Thử xoá bộ lọc hoặc dùng từ khoá khác.",
      actionHtml: `<p><button class="btn btn--outline" type="button" id="empty-reset">Xoá bộ lọc</button></p>`,
    });
    document.getElementById("empty-reset")?.addEventListener("click", () => dom.reset?.click());
    renderPagination(dom.pagination, {
      page: 1,
      totalItems: 0,
      pageSize: PAGE_SIZE,
      onChange: () => {},
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  renderProductGrid(dom.grid, paginate(products, state.page, PAGE_SIZE));
  renderPagination(dom.pagination, {
    page: state.page,
    totalItems: products.length,
    pageSize: PAGE_SIZE,
    onChange: (page) => {
      state.page = page;
      renderResults(products);
      window.scrollTo({ top: dom.grid.offsetTop - 120, behavior: "smooth" });
    },
  });
}

initProductsPage().catch((error) => reportError("products/init", error));
