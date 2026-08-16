// ==========================================================================
// ADMIN.JS
// Script của trang quản trị (admin.html).
//
// File này làm gì:
//   - Chặn truy cập: chỉ user có Users/{uid}.role === "admin" mới vào được
//     (requireAdmin() đọc Firestore, không chỉ ẩn nút bằng JS).
//   - Router theo hash: #dashboard, #products, #categories, #orders, #users,
//     #reviews, #settings.
//   - Dashboard: doanh thu, số đơn, số user, số sản phẩm, đơn hôm nay, đơn gần
//     đây và biểu đồ doanh thu 7 ngày.
//   - CRUD Products (kèm upload nhiều ảnh lên Storage, preview + progress).
//   - CRUD Categories.
//   - Orders: xem chi tiết, đổi trạng thái, tìm kiếm, lọc theo status và ngày.
//   - Users: đổi role, khoá/mở khoá (cờ disabled trong Firestore).
//   - Reviews: xem và xoá.
//   - Settings: lưu cấu hình cửa hàng vào Settings/general.
//
// File nào sử dụng nó: admin.html
// Firebase service được sử dụng: Authentication, Cloud Firestore
//   (Products, Categories, Orders, Users, Reviews, Settings), Storage (ảnh).
// ==========================================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { db, storage, COLLECTIONS } from "./firebase-config.js";
import { requireAdmin, getCurrentProfile, logout } from "./auth.js";
import { openModal } from "../components/modal.js";
import { renderPagination, paginate } from "../components/pagination.js";
import {
  confirmAction,
  debounce,
  escapeHtml,
  formatCurrency,
  isValidImageUrl,
  formatDate,
  getInitials,
  ORDER_STATUS_LABELS,
  orderStatusPill,
  primaryImage,
  bindImageFallback,
  reportError,
  setButtonLoading,
  showToast,
  slugify,
  stateBlock,
  toDate,
} from "./utils.js";

/** Cache dữ liệu đã tải để không phải đọc lại Firestore mỗi lần đổi tab. */
const cache = {
  products: null,
  categories: null,
  orders: null,
  users: null,
  reviews: null,
};

/** Trạng thái phân trang/tìm kiếm của từng bảng. */
const tableState = {
  products: { page: 1, keyword: "", category: "", pageSize: 10 },
  orders: { page: 1, keyword: "", status: "", date: "", pageSize: 10 },
  users: { page: 1, keyword: "", role: "", pageSize: 10 },
  reviews: { page: 1, pageSize: 10 },
};

/** Các trang của khu vực quản trị. */
const PAGES = {
  dashboard: { label: "Dashboard", render: renderDashboard },
  products: { label: "Products", render: renderProducts },
  categories: { label: "Categories", render: renderCategories },
  orders: { label: "Orders", render: renderOrders },
  users: { label: "Users", render: renderUsers },
  reviews: { label: "Reviews", render: renderReviews },
  settings: { label: "Settings", render: renderSettings },
};

let mainEl = null;

// --------------------------------------------------------------------------
// Khởi động
// --------------------------------------------------------------------------

/** Điểm khởi động của trang quản trị. */
async function initAdmin() {
  const session = await requireAdmin();
  if (!session) return;

  mainEl = document.getElementById("admin-main");
  document.getElementById("admin-shell")?.classList.remove("hidden");
  document.getElementById("admin-gate")?.classList.add("hidden");

  renderTopbarUser(session.profile);
  buildSidebar();
  initSidebarToggle();
  initLogout();

  window.addEventListener("hashchange", route);
  await route();
}

/**
 * Hiển thị tên/avatar admin trên topbar.
 * @param {object} profile
 */
function renderTopbarUser(profile) {
  const slot = document.getElementById("admin-user");
  if (!slot) return;
  const name = profile.name || "Admin";
  slot.innerHTML = `
    ${
      profile.avatar
        ? `<img class="avatar" src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(name)}">`
        : `<span class="avatar avatar--initials">${escapeHtml(getInitials(name))}</span>`
    }
    <span>${escapeHtml(name)}</span>`;
}

/** Sinh menu sidebar từ PAGES. */
function buildSidebar() {
  const nav = document.getElementById("admin-nav");
  if (!nav) return;
  nav.innerHTML = Object.entries(PAGES)
    .map(
      ([key, page]) =>
        `<a class="admin-nav__link" href="#${key}" data-nav="${key}">${escapeHtml(
          page.label
        )}</a>`
    )
    .join("");
}

/** Nút đăng xuất trên topbar quản trị. */
function initLogout() {
  document.getElementById("admin-logout")?.addEventListener("click", async () => {
    try {
      await logout();
      location.href = "index.html";
    } catch (error) {
      reportError("admin/logout", error);
    }
  });
}

/** Nút mở/đóng sidebar trên mobile. */
function initSidebarToggle() {
  const sidebar = document.getElementById("admin-sidebar");
  const toggle = document.getElementById("admin-menu-toggle");
  toggle?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));
  sidebar?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => sidebar.classList.remove("is-open"));
  });
}

/** Điều hướng theo hash. */
async function route() {
  const key = (location.hash || "#dashboard").slice(1);
  const page = PAGES[key] ? key : "dashboard";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === page);
  });
  mainEl.innerHTML = `<div class="admin-card"><span class="spinner"></span> Đang tải ${escapeHtml(
    PAGES[page].label
  )}...</div>`;
  try {
    await PAGES[page].render();
  } catch (error) {
    const message = reportError(`admin/${page}`, error, { silent: true });
    mainEl.innerHTML = stateBlock({
      title: `Không tải được ${PAGES[page].label}`,
      text: message,
      type: "error",
    });
  }
}

// --------------------------------------------------------------------------
// Lớp dữ liệu (đọc toàn bộ collection, dùng cache)
// --------------------------------------------------------------------------

/**
 * Đọc toàn bộ document của một collection và map thành mảng object.
 * @param {string} name
 * @returns {Promise<Array<object>>}
 */
async function loadCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

/**
 * Đọc dữ liệu (dùng cache nếu đã có).
 * @param {"products"|"categories"|"orders"|"users"|"reviews"} key
 * @param {boolean} [force=false]
 */
async function getData(key, force = false) {
  if (!force && cache[key]) return cache[key];
  const collectionName = {
    products: COLLECTIONS.products,
    categories: COLLECTIONS.categories,
    orders: COLLECTIONS.orders,
    users: COLLECTIONS.users,
    reviews: COLLECTIONS.reviews,
  }[key];
  cache[key] = await loadCollection(collectionName);
  return cache[key];
}

// --------------------------------------------------------------------------
// DASHBOARD
// --------------------------------------------------------------------------

/** Render trang tổng quan. */
async function renderDashboard() {
  const [orders, users, products, categories] = await Promise.all([
    getData("orders"),
    getData("users"),
    getData("products"),
    getData("categories"),
  ]);

  // Doanh thu chỉ tính đơn không bị huỷ.
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((order) => {
    const created = toDate(order.createdAt);
    return created && created >= startOfToday;
  });

  const pendingCount = orders.filter((order) => order.status === "pending").length;

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Dashboard</h1>
      <div class="admin-page__actions">
        <button class="btn btn--outline btn--sm" type="button" id="dashboard-refresh">Làm mới</button>
      </div>
    </div>

    <div class="stat-grid">
      ${statCard("Tổng doanh thu", formatCurrency(revenue), "Không tính đơn đã huỷ")}
      ${statCard("Tổng đơn hàng", String(orders.length), `${pendingCount} đơn chờ xác nhận`)}
      ${statCard("Người dùng", String(users.length), `${
        users.filter((user) => user.role === "admin").length
      } admin`)}
      ${statCard("Sản phẩm", String(products.length), `${
        products.filter((product) => product.active !== false).length
      } đang bán`)}
      ${statCard("Danh mục", String(categories.length), "")}
      ${statCard("Đơn hôm nay", String(todayOrders.length), formatDate(new Date()))}
    </div>

    <div class="admin-card">
      <h2 class="panel__title">Doanh thu 7 ngày gần nhất</h2>
      ${revenueChartHtml(validOrders)}
    </div>

    <div class="admin-card">
      <h2 class="panel__title">Đơn hàng gần đây</h2>
      ${recentOrdersHtml(orders)}
    </div>`;

  document.getElementById("dashboard-refresh")?.addEventListener("click", async () => {
    await Promise.all([
      getData("orders", true),
      getData("users", true),
      getData("products", true),
      getData("categories", true),
    ]);
    await renderDashboard();
    showToast("Đã làm mới dữ liệu.", "success");
  });
}

/**
 * HTML một thẻ thống kê.
 * @param {string} label
 * @param {string} value
 * @param {string} hint
 */
function statCard(label, value, hint) {
  return `<div class="stat">
    <div class="stat__label">${escapeHtml(label)}</div>
    <div class="stat__value">${escapeHtml(value)}</div>
    ${hint ? `<div class="stat__hint">${escapeHtml(hint)}</div>` : ""}
  </div>`;
}

/**
 * Biểu đồ cột doanh thu 7 ngày (CSS thuần, không cần thư viện ngoài).
 * @param {Array<object>} orders
 * @returns {string}
 */
function revenueChartHtml(orders) {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    days.push({ date: day, total: 0 });
  }
  orders.forEach((order) => {
    const created = toDate(order.createdAt);
    if (!created) return;
    const bucket = days.find((day) => {
      const next = new Date(day.date);
      next.setDate(next.getDate() + 1);
      return created >= day.date && created < next;
    });
    if (bucket) bucket.total += Number(order.total) || 0;
  });

  const max = Math.max(...days.map((day) => day.total), 1);
  return `<div class="chart">
    ${days
      .map(
        (day) => `<div class="chart__col">
          <span class="chart__value">${day.total ? Math.round(day.total / 1000) + "k" : ""}</span>
          <div class="chart__bar" style="height:${Math.round((day.total / max) * 100)}%"></div>
          <span class="chart__label">${day.date.getDate()}/${day.date.getMonth() + 1}</span>
        </div>`
      )
      .join("")}
  </div>`;
}

/**
 * Bảng 8 đơn hàng gần nhất.
 * @param {Array<object>} orders
 * @returns {string}
 */
function recentOrdersHtml(orders) {
  const recent = [...orders]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
    .slice(0, 8);
  if (!recent.length) return `<p class="text-muted">Chưa có đơn hàng nào.</p>`;
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
    <tbody>${recent
      .map(
        (order) => `<tr>
          <td><code>${escapeHtml(order.id.slice(0, 8).toUpperCase())}</code></td>
          <td>${escapeHtml(order.customerName || "—")}</td>
          <td>${formatDate(order.createdAt, { withTime: true })}</td>
          <td>${formatCurrency(order.total)}</td>
          <td>${orderStatusPill(order.status)}</td>
        </tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

// --------------------------------------------------------------------------
// PRODUCTS
// --------------------------------------------------------------------------

/** Render trang quản lý sản phẩm. */
async function renderProducts() {
  const [products, categories] = await Promise.all([
    getData("products"),
    getData("categories"),
  ]);
  const state = tableState.products;

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Products</h1>
      <div class="admin-page__actions">
        <button class="btn btn--outline btn--sm" type="button" data-refresh>Làm mới</button>
        <button class="btn btn--sm" type="button" data-create>+ Thêm sản phẩm</button>
      </div>
    </div>
    <div class="admin-card">
      <div class="admin-toolbar">
        <input class="input" type="search" placeholder="Tìm theo tên..."
          value="${escapeHtml(state.keyword)}" data-search>
        <select class="select" data-category>
          <option value="">Tất cả danh mục</option>
          ${categories
            .map(
              (category) =>
                `<option value="${escapeHtml(category.name || "")}" ${
                  state.category === category.name ? "selected" : ""
                }>${escapeHtml(category.name || "")}</option>`
            )
            .join("")}
        </select>
        <span class="text-muted" data-count></span>
      </div>
      <div data-table></div>
      <div class="pagination" data-pagination></div>
    </div>`;

  const tableEl = mainEl.querySelector("[data-table]");
  const paginationEl = mainEl.querySelector("[data-pagination]");
  const countEl = mainEl.querySelector("[data-count]");

  const paint = () => {
    const keyword = state.keyword.toLowerCase();
    const filtered = products.filter((product) => {
      if (state.category && product.category !== state.category) return false;
      if (keyword && !String(product.name || "").toLowerCase().includes(keyword)) return false;
      return true;
    });
    countEl.textContent = `${filtered.length} sản phẩm`;

    if (!filtered.length) {
      tableEl.innerHTML = stateBlock({
        title: "Không có sản phẩm",
        text: 'Bấm "Thêm sản phẩm" để tạo mới.',
      });
      paginationEl.innerHTML = "";
      return;
    }

    tableEl.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th>
        <th>Nổi bật</th><th>Hiển thị</th><th></th></tr></thead>
      <tbody>${paginate(filtered, state.page, state.pageSize)
        .map(
          (product) => `<tr>
            <td><img class="table__thumb" src="${escapeHtml(
              primaryImage(product, product.name || "SP")
            )}" alt="" data-fallback="SP"></td>
            <td><strong>${escapeHtml(product.name || "")}</strong></td>
            <td>${escapeHtml(product.category || "—")}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${Number(product.stock) || 0}</td>
            <td>${product.featured ? "✓" : "—"}</td>
            <td>${product.active === false ? "Tắt" : "Bật"}</td>
            <td><div class="table__actions">
              <button class="btn btn--outline btn--sm" type="button" data-edit="${escapeHtml(
                product.id
              )}">Sửa</button>
              <button class="btn btn--danger btn--sm" type="button" data-delete="${escapeHtml(
                product.id
              )}">Xoá</button>
            </div></td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>`;

    bindImageFallback(tableEl);
    renderPagination(paginationEl, {
      page: state.page,
      totalItems: filtered.length,
      pageSize: state.pageSize,
      onChange: (page) => {
        state.page = page;
        paint();
      },
    });

    tableEl.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((item) => item.id === button.dataset.edit);
        if (product) openProductModal(product, categories);
      });
    });
    tableEl.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteProduct(button.dataset.delete));
    });
  };

  mainEl.querySelector("[data-search]").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim();
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-category]").addEventListener("change", (event) => {
    state.category = event.target.value;
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-create]").addEventListener("click", () =>
    openProductModal(null, categories)
  );
  mainEl.querySelector("[data-refresh]").addEventListener("click", async () => {
    await getData("products", true);
    await renderProducts();
  });

  paint();
}

/**
 * Mở modal tạo/sửa sản phẩm.
 * @param {object|null} product null nghĩa là tạo mới
 * @param {Array<object>} categories
 */
function openProductModal(product, categories) {
  const isEdit = Boolean(product);
  // Danh sách URL ảnh đang có; upload xong sẽ push thêm vào đây.
  let images = Array.isArray(product?.images)
    ? [...product.images]
    : product?.image
    ? [product.image]
    : [];

  const { element, close } = openModal({
    title: isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm",
    size: "lg",
    bodyHtml: `
      <form id="product-form">
        <div class="form-grid form-grid--2">
          <div class="field">
            <label class="field__label" for="p-name">Tên sản phẩm *</label>
            <input class="input" id="p-name" name="name" required
              value="${escapeHtml(product?.name || "")}">
          </div>
          <div class="field">
            <label class="field__label" for="p-price">Giá (VND) *</label>
            <input class="input" id="p-price" name="price" type="number" min="0" step="1000" required
              value="${Number(product?.price) || 0}">
          </div>
          <div class="field">
            <label class="field__label" for="p-category">Danh mục *</label>
            <input class="input" id="p-category" name="category" list="category-options" required
              value="${escapeHtml(product?.category || "")}">
            <datalist id="category-options">
              ${categories
                .map((category) => `<option value="${escapeHtml(category.name || "")}"></option>`)
                .join("")}
            </datalist>
          </div>
          <div class="field">
            <label class="field__label" for="p-stock">Tồn kho *</label>
            <input class="input" id="p-stock" name="stock" type="number" min="0" required
              value="${Number(product?.stock) || 0}">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="p-description">Mô tả</label>
          <textarea class="textarea" id="p-description" name="description">${escapeHtml(
            product?.description || ""
          )}</textarea>
        </div>
        <div class="field">
          <label class="field__label" for="p-image-url">Ảnh sản phẩm theo URL</label>
          <div class="input-row">
            <input class="input" id="p-image-url" type="url" inputmode="url"
              placeholder="https://... (dán link ảnh)">
            <button class="btn btn--outline" type="button" id="p-image-add">Thêm ảnh</button>
          </div>
          <div class="image-preview image-preview--single" id="p-url-preview"></div>
          <p class="form-note">Preview hiện ngay khi dán URL. Nhấn "Thêm ảnh" hoặc Enter để đưa vào danh sách bên dưới.</p>
        </div>
        <div class="field">
          <span class="field__label">Hoặc tải ảnh lên Firebase Storage</span>
          <input class="input" id="p-images" type="file" accept="image/*" multiple>
          <div class="upload-progress hidden" id="p-progress">
            <div class="upload-progress__bar" id="p-progress-bar"></div>
          </div>
          <div class="image-preview" id="p-preview"></div>
          <p class="form-note">Ảnh đầu tiên trong danh sách là ảnh chính (Firestore lưu <code>image</code> và <code>images[]</code>, chỉ lưu URL chứ không lưu file).</p>
        </div>
        <div class="field">
          <span class="field__label">Thông số kỹ thuật</span>
          <div id="p-specs"></div>
          <button class="btn btn--outline btn--sm" type="button" id="p-spec-add">+ Thêm dòng</button>
        </div>
        <div class="form-grid form-grid--2">
          <label class="checkbox-row">
            <input type="checkbox" name="featured" ${product?.featured ? "checked" : ""}>
            <span>Sản phẩm nổi bật</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="active" ${product?.active === false ? "" : "checked"}>
            <span>Hiển thị trên website</span>
          </label>
        </div>
      </form>`,
    footerHtml: `
      <button class="btn btn--outline" type="button" data-modal-close>Huỷ</button>
      <button class="btn" type="button" id="p-save">${isEdit ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>`,
  });

  const previewEl = element.querySelector("#p-preview");
  const specsEl = element.querySelector("#p-specs");
  const progressWrap = element.querySelector("#p-progress");
  const progressBar = element.querySelector("#p-progress-bar");
  const fileInput = element.querySelector("#p-images");
  const urlInput = element.querySelector("#p-image-url");
  const urlPreviewEl = element.querySelector("#p-url-preview");

  /** Vẽ lại danh sách ảnh đã có kèm nút xoá. */
  const paintPreview = () => {
    previewEl.innerHTML = images
      .map(
        (url, index) => `<div class="image-preview__item">
          <img src="${escapeHtml(url)}" alt="Ảnh ${index + 1}" data-fallback="Lỗi ảnh">
          ${index === 0 ? `<span class="image-preview__main">Chính</span>` : ""}
          <button class="image-preview__remove" type="button" data-remove="${index}"
            aria-label="Xoá ảnh">✕</button>
        </div>`
      )
      .join("");
    bindImageFallback(previewEl);
    previewEl.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        images.splice(Number(button.dataset.remove), 1);
        paintPreview();
      });
    });
  };
  paintPreview();

  /** Preview URL ảnh đang nhập (chưa thêm vào danh sách). */
  const paintUrlPreview = () => {
    const url = urlInput.value.trim();
    if (!url) {
      urlPreviewEl.innerHTML = "";
      return;
    }
    if (!isValidImageUrl(url)) {
      urlPreviewEl.innerHTML = `<p class="form-note form-note--error">URL phải bắt đầu bằng http:// hoặc https://</p>`;
      return;
    }
    urlPreviewEl.innerHTML = `<div class="image-preview__item">
      <img src="${escapeHtml(url)}" alt="Preview ảnh" data-fallback="Lỗi ảnh">
    </div>`;
    bindImageFallback(urlPreviewEl);
  };

  /** Đưa URL đang nhập vào danh sách ảnh của sản phẩm. */
  const addUrlToImages = () => {
    const url = urlInput.value.trim();
    if (!url) return;
    if (!isValidImageUrl(url)) {
      showToast("URL ảnh không hợp lệ (cần http:// hoặc https://).", "warning");
      return;
    }
    if (images.includes(url)) {
      showToast("Ảnh này đã có trong danh sách.", "info");
      return;
    }
    images.push(url);
    urlInput.value = "";
    paintUrlPreview();
    paintPreview();
  };

  urlInput.addEventListener("input", debounce(paintUrlPreview, 350));
  urlInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addUrlToImages();
  });
  element.querySelector("#p-image-add").addEventListener("click", addUrlToImages);

  /** Thêm một dòng thông số. */
  const addSpecRow = (key = "", value = "") => {
    const row = document.createElement("div");
    row.className = "spec-row";
    row.innerHTML = `
      <input class="input" placeholder="Tên thông số" value="${escapeHtml(key)}" data-spec-key>
      <input class="input" placeholder="Giá trị" value="${escapeHtml(value)}" data-spec-value>
      <button class="btn btn--ghost btn--sm" type="button" data-spec-remove>✕</button>`;
    row.querySelector("[data-spec-remove]").addEventListener("click", () => row.remove());
    specsEl.appendChild(row);
  };
  Object.entries(product?.specs || {}).forEach(([key, value]) => addSpecRow(key, String(value)));
  if (!Object.keys(product?.specs || {}).length) addSpecRow();
  element.querySelector("#p-spec-add").addEventListener("click", () => addSpecRow());

  // Upload ảnh ngay khi chọn file, có progress tổng.
  fileInput.addEventListener("change", async () => {
    const files = [...(fileInput.files || [])];
    if (!files.length) return;
    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      showToast("Chỉ được chọn file ảnh.", "warning");
      fileInput.value = "";
      return;
    }
    progressWrap.classList.remove("hidden");
    try {
      for (let index = 0; index < files.length; index += 1) {
        const url = await uploadImage(files[index], (percent) => {
          const overall = Math.round(((index + percent / 100) / files.length) * 100);
          progressBar.style.width = `${overall}%`;
        });
        images.push(url);
        paintPreview();
      }
      showToast("Đã tải ảnh lên Storage.", "success");
    } catch (error) {
      reportError("admin/uploadImage", error);
    } finally {
      progressWrap.classList.add("hidden");
      progressBar.style.width = "0";
      fileInput.value = "";
    }
  });

  element.querySelector("#p-save").addEventListener("click", async (event) => {
    const form = element.querySelector("#product-form");
    if (!form.reportValidity()) return;

    const specs = {};
    specsEl.querySelectorAll(".spec-row").forEach((row) => {
      const key = row.querySelector("[data-spec-key]").value.trim();
      const value = row.querySelector("[data-spec-value]").value.trim();
      if (key) specs[key] = value;
    });

    const payload = {
      name: form.name.value.trim(),
      price: Number(form.price.value) || 0,
      description: form.description.value.trim(),
      image: images[0] || "",
      images,
      category: form.category.value.trim() || "Khác",
      stock: Number(form.stock.value) || 0,
      featured: form.featured.checked,
      active: form.active.checked,
      specs,
      updatedAt: serverTimestamp(),
    };

    setButtonLoading(event.currentTarget, true, "Đang lưu...");
    try {
      if (isEdit) {
        await updateDoc(doc(db, COLLECTIONS.products, product.id), payload);
        showToast("Đã cập nhật sản phẩm.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.products), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast("Đã tạo sản phẩm mới.", "success");
      }
      close();
      await getData("products", true);
      await renderProducts();
    } catch (error) {
      reportError("admin/saveProduct", error);
      setButtonLoading(event.currentTarget, false);
    }
  });
}

/**
 * Upload một file ảnh lên Storage và trả về download URL.
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>}
 */
function uploadImage(file, onProgress) {
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const task = uploadBytesResumable(storageRef(storage, path), file, {
    contentType: file.type,
  });
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          onProgress((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100);
        }
      },
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Xoá một sản phẩm.
 * @param {string} productId
 */
async function deleteProduct(productId) {
  const ok = await confirmAction(
    "Xoá sản phẩm này? Ảnh đã tải lên Storage sẽ không bị xoá tự động.",
    { title: "Xoá sản phẩm", confirmText: "Xoá", danger: true }
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.products, productId));
    showToast("Đã xoá sản phẩm.", "success");
    await getData("products", true);
    await renderProducts();
  } catch (error) {
    reportError("admin/deleteProduct", error);
  }
}

// --------------------------------------------------------------------------
// CATEGORIES
// --------------------------------------------------------------------------

/** Render trang quản lý danh mục. */
async function renderCategories() {
  const categories = await getData("categories");

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Categories</h1>
      <div class="admin-page__actions">
        <button class="btn btn--sm" type="button" data-create>+ Thêm danh mục</button>
      </div>
    </div>
    <div class="admin-card">
      ${
        categories.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Ảnh</th><th>Tên</th><th>Slug</th><th>Mô tả</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>${categories
                .map(
                  (category) => `<tr>
                    <td><img class="table__thumb" src="${escapeHtml(
                      primaryImage(category, category.name || "DM")
                    )}" alt="" data-fallback="DM"></td>
                    <td><strong>${escapeHtml(category.name || "")}</strong></td>
                    <td><code>${escapeHtml(category.slug || "")}</code></td>
                    <td>${escapeHtml(category.description || "—")}</td>
                    <td>${category.active === false ? "Tắt" : "Bật"}</td>
                    <td><div class="table__actions">
                      <button class="btn btn--outline btn--sm" type="button" data-edit="${escapeHtml(
                        category.id
                      )}">Sửa</button>
                      <button class="btn btn--danger btn--sm" type="button" data-delete="${escapeHtml(
                        category.id
                      )}">Xoá</button>
                    </div></td>
                  </tr>`
                )
                .join("")}</tbody></table></div>`
          : stateBlock({ title: "Chưa có danh mục", text: "Thêm danh mục đầu tiên." })
      }
    </div>`;

  bindImageFallback(mainEl);
  mainEl.querySelector("[data-create]").addEventListener("click", () =>
    openCategoryModal(null)
  );
  mainEl.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = categories.find((item) => item.id === button.dataset.edit);
      if (category) openCategoryModal(category);
    });
  });
  mainEl.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.delete));
  });
}

/**
 * Mở modal tạo/sửa danh mục.
 * @param {object|null} category
 */
function openCategoryModal(category) {
  const isEdit = Boolean(category);
  let image = category?.image || "";

  const { element, close } = openModal({
    title: isEdit ? "Sửa danh mục" : "Thêm danh mục",
    bodyHtml: `
      <form id="category-form">
        <div class="field">
          <label class="field__label" for="c-name">Tên danh mục *</label>
          <input class="input" id="c-name" name="name" required
            value="${escapeHtml(category?.name || "")}">
        </div>
        <div class="field">
          <label class="field__label" for="c-slug">Slug (tự sinh nếu để trống)</label>
          <input class="input" id="c-slug" name="slug" value="${escapeHtml(
            category?.slug || ""
          )}">
        </div>
        <div class="field">
          <label class="field__label" for="c-description">Mô tả</label>
          <textarea class="textarea" id="c-description" name="description">${escapeHtml(
            category?.description || ""
          )}</textarea>
        </div>
        <div class="field">
          <label class="field__label" for="c-image-url">Ảnh danh mục theo URL</label>
          <input class="input" id="c-image-url" type="url" inputmode="url"
            placeholder="https://..." value="${escapeHtml(category?.image || "")}">
          <p class="form-note">Preview hiện ngay khi dán URL.</p>
        </div>
        <div class="field">
          <span class="field__label">Hoặc tải ảnh lên Firebase Storage</span>
          <input class="input" id="c-image" type="file" accept="image/*">
          <div class="upload-progress hidden" id="c-progress">
            <div class="upload-progress__bar" id="c-progress-bar"></div>
          </div>
          <div class="image-preview image-preview--single" id="c-preview"></div>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" name="active" ${category?.active === false ? "" : "checked"}>
          <span>Đang hoạt động</span>
        </label>
      </form>`,
    footerHtml: `
      <button class="btn btn--outline" type="button" data-modal-close>Huỷ</button>
      <button class="btn" type="button" id="c-save">${isEdit ? "Lưu" : "Tạo"}</button>`,
  });

  const previewEl = element.querySelector("#c-preview");
  const progressWrap = element.querySelector("#c-progress");
  const progressBar = element.querySelector("#c-progress-bar");

  const urlInput = element.querySelector("#c-image-url");

  const paintPreview = () => {
    previewEl.innerHTML = image
      ? `<div class="image-preview__item"><img src="${escapeHtml(
          image
        )}" alt="Ảnh danh mục" data-fallback="Lỗi ảnh"></div>`
      : "";
    bindImageFallback(previewEl);
  };
  paintPreview();

  // Nhập URL: cập nhật ảnh + preview ngay (không cần upload).
  urlInput.addEventListener(
    "input",
    debounce(() => {
      const url = urlInput.value.trim();
      if (url && !isValidImageUrl(url)) return;
      image = url;
      paintPreview();
    }, 350)
  );

  element.querySelector("#c-image").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ được chọn file ảnh.", "warning");
      return;
    }
    progressWrap.classList.remove("hidden");
    try {
      image = await uploadImage(file, (percent) => {
        progressBar.style.width = `${Math.round(percent)}%`;
      });
      urlInput.value = image;
      paintPreview();
      showToast("Đã tải ảnh lên.", "success");
    } catch (error) {
      reportError("admin/uploadCategoryImage", error);
    } finally {
      progressWrap.classList.add("hidden");
      progressBar.style.width = "0";
    }
  });

  element.querySelector("#c-save").addEventListener("click", async (event) => {
    const form = element.querySelector("#category-form");
    if (!form.reportValidity()) return;
    const name = form.name.value.trim();
    const payload = {
      name,
      slug: form.slug.value.trim() || slugify(name),
      description: form.description.value.trim(),
      image,
      active: form.active.checked,
      updatedAt: serverTimestamp(),
    };

    setButtonLoading(event.currentTarget, true, "Đang lưu...");
    try {
      if (isEdit) {
        await updateDoc(doc(db, COLLECTIONS.categories, category.id), payload);
        showToast("Đã cập nhật danh mục.", "success");
      } else {
        await addDoc(collection(db, COLLECTIONS.categories), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast("Đã tạo danh mục.", "success");
      }
      close();
      await getData("categories", true);
      await renderCategories();
    } catch (error) {
      reportError("admin/saveCategory", error);
      setButtonLoading(event.currentTarget, false);
    }
  });
}

/**
 * Xoá một danh mục.
 * @param {string} categoryId
 */
async function deleteCategory(categoryId) {
  const ok = await confirmAction(
    "Xoá danh mục này? Sản phẩm thuộc danh mục sẽ không bị xoá.",
    { title: "Xoá danh mục", confirmText: "Xoá", danger: true }
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.categories, categoryId));
    showToast("Đã xoá danh mục.", "success");
    await getData("categories", true);
    await renderCategories();
  } catch (error) {
    reportError("admin/deleteCategory", error);
  }
}

// --------------------------------------------------------------------------
// ORDERS
// --------------------------------------------------------------------------

/** Render trang quản lý đơn hàng. */
async function renderOrders() {
  const orders = await getData("orders");
  const state = tableState.orders;

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Orders</h1>
      <div class="admin-page__actions">
        <button class="btn btn--outline btn--sm" type="button" data-refresh>Làm mới</button>
      </div>
    </div>
    <div class="admin-card">
      <div class="admin-toolbar">
        <input class="input" type="search" placeholder="Tìm mã đơn / tên / SĐT..."
          value="${escapeHtml(state.keyword)}" data-search>
        <select class="select" data-status>
          <option value="">Tất cả trạng thái</option>
          ${Object.entries(ORDER_STATUS_LABELS)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${
                  state.status === value ? "selected" : ""
                }>${escapeHtml(label)}</option>`
            )
            .join("")}
        </select>
        <input class="input" type="date" value="${escapeHtml(state.date)}" data-date
          aria-label="Lọc theo ngày">
        <span class="text-muted" data-count></span>
      </div>
      <div data-table></div>
      <div class="pagination" data-pagination></div>
    </div>`;

  const tableEl = mainEl.querySelector("[data-table]");
  const paginationEl = mainEl.querySelector("[data-pagination]");
  const countEl = mainEl.querySelector("[data-count]");

  const paint = () => {
    const keyword = state.keyword.toLowerCase();
    const filtered = orders
      .filter((order) => {
        if (state.status && order.status !== state.status) return false;
        if (state.date) {
          const created = toDate(order.createdAt);
          if (!created) return false;
          const day = new Date(state.date);
          day.setHours(0, 0, 0, 0);
          const next = new Date(day);
          next.setDate(next.getDate() + 1);
          if (!(created >= day && created < next)) return false;
        }
        if (keyword) {
          const haystack = `${order.id} ${order.customerName || ""} ${order.phone || ""}`.toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      })
      .sort(
        (a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)
      );

    const revenue = filtered
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    countEl.textContent = `${filtered.length} đơn · ${formatCurrency(revenue)}`;

    if (!filtered.length) {
      tableEl.innerHTML = stateBlock({ title: "Không có đơn hàng phù hợp" });
      paginationEl.innerHTML = "";
      return;
    }

    tableEl.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>SP</th><th>Tổng</th>
        <th>Trạng thái</th><th></th></tr></thead>
      <tbody>${paginate(filtered, state.page, state.pageSize)
        .map(
          (order) => `<tr>
            <td><code>${escapeHtml(order.id.slice(0, 8).toUpperCase())}</code></td>
            <td>${escapeHtml(order.customerName || "—")}<br>
              <span class="text-muted">${escapeHtml(order.phone || "")}</span></td>
            <td>${formatDate(order.createdAt, { withTime: true })}</td>
            <td>${Array.isArray(order.products) ? order.products.length : 0}</td>
            <td>${formatCurrency(order.total)}</td>
            <td>${orderStatusPill(order.status)}</td>
            <td><div class="table__actions">
              <button class="btn btn--outline btn--sm" type="button" data-view="${escapeHtml(
                order.id
              )}">Chi tiết</button>
            </div></td>
          </tr>`
        )
        .join("")}</tbody></table></div>`;

    renderPagination(paginationEl, {
      page: state.page,
      totalItems: filtered.length,
      pageSize: state.pageSize,
      onChange: (page) => {
        state.page = page;
        paint();
      },
    });

    tableEl.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const order = orders.find((item) => item.id === button.dataset.view);
        if (order) openOrderModal(order);
      });
    });
  };

  mainEl.querySelector("[data-search]").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim();
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-status]").addEventListener("change", (event) => {
    state.status = event.target.value;
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-date]").addEventListener("change", (event) => {
    state.date = event.target.value;
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-refresh]").addEventListener("click", async () => {
    await getData("orders", true);
    await renderOrders();
  });

  paint();
}

/**
 * Modal chi tiết đơn hàng + đổi trạng thái.
 * @param {object} order
 */
function openOrderModal(order) {
  const products = Array.isArray(order.products) ? order.products : [];
  const { element, close } = openModal({
    title: `Đơn #${order.id.slice(0, 8).toUpperCase()}`,
    size: "lg",
    bodyHtml: `
      <div class="summary-row"><span>Khách hàng</span><strong>${escapeHtml(
        order.customerName || "—"
      )}</strong></div>
      <div class="summary-row"><span>Điện thoại</span><strong>${escapeHtml(
        order.phone || "—"
      )}</strong></div>
      <div class="summary-row"><span>Địa chỉ</span><span style="text-align:right;max-width:60%">${escapeHtml(
        order.address || "—"
      )}</span></div>
      <div class="summary-row"><span>Ghi chú</span><span>${escapeHtml(order.note || "—")}</span></div>
      <div class="summary-row"><span>Thanh toán</span><span>${escapeHtml(
        order.paymentMethod || "—"
      )}</span></div>
      <div class="summary-row"><span>Ngày tạo</span><span>${formatDate(order.createdAt, {
        withTime: true,
      })}</span></div>
      <hr style="border:0;border-top:1px solid var(--color-gray-200);margin:var(--space-3) 0">
      ${products
        .map(
          (item) => `<div class="order-line">
            <img src="${escapeHtml(primaryImage(item, item.name || "SP"))}"
              alt="" data-fallback="SP">
            <div style="flex:1">
              <div style="font-weight:700">${escapeHtml(item.name || "")}</div>
              <div class="text-muted">${item.quantity} × ${formatCurrency(item.price)}</div>
            </div>
            <strong>${formatCurrency(
              (Number(item.price) || 0) * (Number(item.quantity) || 0)
            )}</strong>
          </div>`
        )
        .join("")}
      <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(
        order.total
      )}</span></div>
      <div class="field" style="margin-top:var(--space-4)">
        <label class="field__label" for="o-status">Trạng thái đơn hàng</label>
        <select class="select" id="o-status">
          ${Object.entries(ORDER_STATUS_LABELS)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${
                  order.status === value ? "selected" : ""
                }>${escapeHtml(label)}</option>`
            )
            .join("")}
        </select>
      </div>`,
    footerHtml: `
      <button class="btn btn--outline" type="button" data-modal-close>Đóng</button>
      <button class="btn" type="button" id="o-save">Cập nhật trạng thái</button>`,
  });

  bindImageFallback(element);

  element.querySelector("#o-save").addEventListener("click", async (event) => {
    const status = element.querySelector("#o-status").value;
    if (status === order.status) {
      close();
      return;
    }
    setButtonLoading(event.currentTarget, true, "Đang lưu...");
    try {
      await updateDoc(doc(db, COLLECTIONS.orders, order.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast("Đã cập nhật trạng thái đơn hàng.", "success");
      close();
      await getData("orders", true);
      await renderOrders();
    } catch (error) {
      reportError("admin/updateOrder", error);
      setButtonLoading(event.currentTarget, false);
    }
  });
}

// --------------------------------------------------------------------------
// USERS
// --------------------------------------------------------------------------

/** Render trang quản lý người dùng. */
async function renderUsers() {
  const users = await getData("users");
  const state = tableState.users;
  const myUid = getCurrentProfile()?.uid;

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Users</h1>
      <div class="admin-page__actions">
        <button class="btn btn--outline btn--sm" type="button" data-refresh>Làm mới</button>
      </div>
    </div>
    <div class="admin-card">
      <p class="form-note">
        Giới hạn bảo mật: Firebase Authentication không cho phép bật/tắt tài khoản
        (<code>disabled</code>) từ client SDK. Nút "Khoá" bên dưới chỉ đặt cờ
        <code>disabled</code> trong Firestore; frontend sẽ tự đăng xuất tài khoản đó.
        Muốn khoá thật ở tầng Authentication cần Cloud Functions + Admin SDK
        (không được đưa service account vào frontend).
      </p>
      <div class="admin-toolbar">
        <input class="input" type="search" placeholder="Tìm tên / email..."
          value="${escapeHtml(state.keyword)}" data-search>
        <select class="select" data-role>
          <option value="">Tất cả vai trò</option>
          <option value="user" ${state.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${state.role === "admin" ? "selected" : ""}>admin</option>
        </select>
        <span class="text-muted" data-count></span>
      </div>
      <div data-table></div>
      <div class="pagination" data-pagination></div>
    </div>`;

  const tableEl = mainEl.querySelector("[data-table]");
  const paginationEl = mainEl.querySelector("[data-pagination]");
  const countEl = mainEl.querySelector("[data-count]");

  const paint = () => {
    const keyword = state.keyword.toLowerCase();
    const filtered = users.filter((user) => {
      if (state.role && (user.role || "user") !== state.role) return false;
      if (keyword) {
        const haystack = `${user.name || ""} ${user.email || ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
    countEl.textContent = `${filtered.length} người dùng`;

    if (!filtered.length) {
      tableEl.innerHTML = stateBlock({ title: "Không có người dùng phù hợp" });
      paginationEl.innerHTML = "";
      return;
    }

    tableEl.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Người dùng</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th>
        <th>Ngày đăng ký</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${paginate(filtered, state.page, state.pageSize)
        .map((user) => {
          const isSelf = user.id === myUid;
          return `<tr>
            <td>${
              user.avatar
                ? `<img class="table__thumb" src="${escapeHtml(user.avatar)}" alt="">`
                : `<span class="avatar avatar--initials">${escapeHtml(
                    getInitials(user.name)
                  )}</span>`
            } ${escapeHtml(user.name || "—")}</td>
            <td>${escapeHtml(user.email || "—")}</td>
            <td>${escapeHtml(user.phone || "—")}</td>
            <td><code>${escapeHtml(user.role || "user")}</code></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>${
              user.disabled === true
                ? '<span class="status-pill status-pill--cancelled">Đã khoá</span>'
                : '<span class="status-pill status-pill--completed">Hoạt động</span>'
            }</td>
            <td><div class="table__actions">
              <button class="btn btn--outline btn--sm" type="button" data-role-toggle="${escapeHtml(
                user.id
              )}" ${isSelf ? "disabled" : ""}>${
            (user.role || "user") === "admin" ? "Hạ về user" : "Nâng lên admin"
          }</button>
              <button class="btn ${
                user.disabled === true ? "btn--outline" : "btn--danger"
              } btn--sm" type="button" data-disable-toggle="${escapeHtml(user.id)}" ${
            isSelf ? "disabled" : ""
          }>${user.disabled === true ? "Mở khoá" : "Khoá"}</button>
            </div></td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;

    renderPagination(paginationEl, {
      page: state.page,
      totalItems: filtered.length,
      pageSize: state.pageSize,
      onChange: (page) => {
        state.page = page;
        paint();
      },
    });

    tableEl.querySelectorAll("[data-role-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const user = users.find((item) => item.id === button.dataset.roleToggle);
        if (user) toggleRole(user);
      });
    });
    tableEl.querySelectorAll("[data-disable-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const user = users.find((item) => item.id === button.dataset.disableToggle);
        if (user) toggleDisabled(user);
      });
    });
  };

  mainEl.querySelector("[data-search]").addEventListener("input", (event) => {
    state.keyword = event.target.value.trim();
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-role]").addEventListener("change", (event) => {
    state.role = event.target.value;
    state.page = 1;
    paint();
  });
  mainEl.querySelector("[data-refresh]").addEventListener("click", async () => {
    await getData("users", true);
    await renderUsers();
  });

  paint();
}

/**
 * Đổi role của một người dùng giữa "user" và "admin".
 * @param {object} user
 */
async function toggleRole(user) {
  const nextRole = (user.role || "user") === "admin" ? "user" : "admin";
  const ok = await confirmAction(
    `Đổi vai trò của ${user.email || user.name} thành "${nextRole}"?`,
    { title: "Đổi vai trò", confirmText: "Đổi" }
  );
  if (!ok) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.users, user.id), {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
    showToast("Đã đổi vai trò.", "success");
    await getData("users", true);
    await renderUsers();
  } catch (error) {
    reportError("admin/toggleRole", error);
  }
}

/**
 * Khoá/mở khoá tài khoản bằng cờ disabled trong Firestore.
 * @param {object} user
 */
async function toggleDisabled(user) {
  const next = user.disabled !== true;
  const ok = await confirmAction(
    next
      ? `Khoá tài khoản ${user.email || user.name}? Người dùng sẽ bị đăng xuất khỏi website.`
      : `Mở khoá tài khoản ${user.email || user.name}?`,
    { title: next ? "Khoá tài khoản" : "Mở khoá", confirmText: "Xác nhận", danger: next }
  );
  if (!ok) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.users, user.id), {
      disabled: next,
      updatedAt: serverTimestamp(),
    });
    showToast(next ? "Đã khoá tài khoản." : "Đã mở khoá tài khoản.", "success");
    await getData("users", true);
    await renderUsers();
  } catch (error) {
    reportError("admin/toggleDisabled", error);
  }
}

// --------------------------------------------------------------------------
// REVIEWS
// --------------------------------------------------------------------------

/** Render trang quản lý đánh giá. */
async function renderReviews() {
  const [reviews, products] = await Promise.all([getData("reviews"), getData("products")]);
  const state = tableState.reviews;
  const productNames = new Map(products.map((product) => [product.id, product.name]));

  const sorted = [...reviews].sort(
    (a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)
  );

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Reviews</h1>
      <div class="admin-page__actions">
        <button class="btn btn--outline btn--sm" type="button" data-refresh>Làm mới</button>
      </div>
    </div>
    <div class="admin-card">
      <div data-table></div>
      <div class="pagination" data-pagination></div>
    </div>`;

  const tableEl = mainEl.querySelector("[data-table]");
  const paginationEl = mainEl.querySelector("[data-pagination]");

  const paint = () => {
    if (!sorted.length) {
      tableEl.innerHTML = stateBlock({ title: "Chưa có đánh giá nào" });
      paginationEl.innerHTML = "";
      return;
    }
    tableEl.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Sản phẩm</th><th>Người viết</th><th>Điểm</th><th>Nội dung</th><th>Ngày</th><th></th></tr></thead>
      <tbody>${paginate(sorted, state.page, state.pageSize)
        .map(
          (review) => `<tr>
            <td><a href="product-detail.html?id=${escapeHtml(review.productId || "")}">${escapeHtml(
            productNames.get(review.productId) || review.productId || "—"
          )}</a></td>
            <td>${escapeHtml(review.userName || "—")}</td>
            <td>${"★".repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</td>
            <td>${escapeHtml(review.comment || "")}</td>
            <td>${formatDate(review.createdAt)}</td>
            <td><button class="btn btn--danger btn--sm" type="button" data-delete="${escapeHtml(
              review.id
            )}">Xoá</button></td>
          </tr>`
        )
        .join("")}</tbody></table></div>`;

    renderPagination(paginationEl, {
      page: state.page,
      totalItems: sorted.length,
      pageSize: state.pageSize,
      onChange: (page) => {
        state.page = page;
        paint();
      },
    });

    tableEl.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const ok = await confirmAction("Xoá đánh giá này?", {
          title: "Xoá đánh giá",
          confirmText: "Xoá",
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteDoc(doc(db, COLLECTIONS.reviews, button.dataset.delete));
          showToast("Đã xoá đánh giá.", "success");
          await getData("reviews", true);
          await renderReviews();
        } catch (error) {
          reportError("admin/deleteReview", error);
        }
      });
    });
  };

  mainEl.querySelector("[data-refresh]").addEventListener("click", async () => {
    await getData("reviews", true);
    await renderReviews();
  });

  paint();
}

// --------------------------------------------------------------------------
// SETTINGS
// --------------------------------------------------------------------------

/** Render trang cấu hình cửa hàng (Settings/general). */
async function renderSettings() {
  let settings = {};
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.settings, "general"));
    if (snapshot.exists()) settings = snapshot.data();
  } catch (error) {
    reportError("admin/loadSettings", error, { silent: true });
  }

  mainEl.innerHTML = `
    <div class="admin-page__head">
      <h1 class="admin-page__title">Settings</h1>
    </div>
    <div class="admin-card">
      <form id="settings-form">
        <div class="form-grid form-grid--2">
          <div class="field">
            <label class="field__label" for="s-storeName">Tên cửa hàng</label>
            <input class="input" id="s-storeName" name="storeName"
              value="${escapeHtml(settings.storeName || "SPORTHUB")}">
          </div>
          <div class="field">
            <label class="field__label" for="s-hotline">Hotline</label>
            <input class="input" id="s-hotline" name="hotline"
              value="${escapeHtml(settings.hotline || "028 1234 5678")}">
          </div>
          <div class="field">
            <label class="field__label" for="s-email">Email hỗ trợ</label>
            <input class="input" id="s-email" name="email" type="email"
              value="${escapeHtml(settings.email || "support@sporthub.example")}">
          </div>
          <div class="field">
            <label class="field__label" for="s-freeShip">Ngưỡng miễn phí vận chuyển (VND)</label>
            <input class="input" id="s-freeShip" name="freeShipThreshold" type="number" min="0"
              value="${Number(settings.freeShipThreshold) || 1000000}">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="s-address">Địa chỉ cửa hàng</label>
          <input class="input" id="s-address" name="address"
            value="${escapeHtml(settings.address || "")}">
        </div>
        <button class="btn" type="submit">Lưu cấu hình</button>
      </form>
      <p class="form-note" style="margin-top:var(--space-3)">
        Cấu hình được lưu ở <code>Settings/general</code>. Ngưỡng miễn phí vận chuyển
        hiện chỉ mang tính hiển thị; logic tính phí đang nằm trong
        <code>js/cart.js → cartTotals()</code>.
      </p>
    </div>`;

  mainEl.querySelector("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Đang lưu...");
    try {
      await setDoc(
        doc(db, COLLECTIONS.settings, "general"),
        {
          storeName: form.storeName.value.trim(),
          hotline: form.hotline.value.trim(),
          email: form.email.value.trim(),
          address: form.address.value.trim(),
          freeShipThreshold: Number(form.freeShipThreshold.value) || 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Đã lưu cấu hình.", "success");
    } catch (error) {
      reportError("admin/saveSettings", error);
    } finally {
      setButtonLoading(button, false);
    }
  });
}

initAdmin().catch((error) => reportError("admin/init", error));
