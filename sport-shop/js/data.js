// ==========================================================================
// DATA.JS
// Lớp truy cập dữ liệu Firestore dùng chung (products, categories, reviews,
// orders của người dùng). Mục đích: không lặp lại truy vấn ở nhiều file.
//
// File này làm gì:
//   - fetchProducts(): đọc Products (chỉ sản phẩm active) + lọc/sắp xếp.
//   - fetchProductById(): đọc một sản phẩm theo id.
//   - fetchCategories(): đọc Categories đang active.
//   - fetchReviews() / createReview(): đánh giá sản phẩm.
//   - fetchMyOrders(): đơn hàng của chính người dùng.
//
// File nào sử dụng nó: js/main.js, js/products.js, js/detail.js, js/orders.js,
//   js/checkout.js
//
// Firebase service được sử dụng: Cloud Firestore.
// ==========================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, COLLECTIONS } from "./firebase-config.js";
import { toDate } from "./utils.js";

/**
 * Chuẩn hoá một document sản phẩm về dạng ổn định để render.
 * @param {import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").DocumentSnapshot} snapshot
 */
function mapProduct(snapshot) {
  const data = snapshot.data() || {};
  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const image = data.image || images[0] || "";
  return {
    id: snapshot.id,
    name: data.name || "Sản phẩm",
    price: Number(data.price) || 0,
    description: data.description || "",
    image,
    images: images.length ? images : image ? [image] : [],
    category: data.category || "Khác",
    stock: Number(data.stock) || 0,
    featured: data.featured === true,
    active: data.active !== false,
    specs: data.specs && typeof data.specs === "object" ? data.specs : {},
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

/**
 * Đọc danh sách sản phẩm.
 * Chỉ dùng where("active","==",true) + orderBy("createdAt") để tránh phải tạo
 * quá nhiều composite index; phần lọc/tìm kiếm còn lại xử lý ở client.
 * @param {{limit?: number, featured?: boolean, includeInactive?: boolean}} [options]
 * @returns {Promise<Array<object>>}
 */
export async function fetchProducts(options = {}) {
  const { limit: max, featured, includeInactive = false } = options;
  const constraints = [];
  if (!includeInactive) constraints.push(where("active", "==", true));
  constraints.push(orderBy("createdAt", "desc"));
  if (max) constraints.push(fsLimit(max));

  let snapshot;
  try {
    snapshot = await getDocs(query(collection(db, COLLECTIONS.products), ...constraints));
  } catch (error) {
    // Nếu thiếu index hoặc document cũ không có createdAt, thử lại không orderBy.
    if (error?.code === "failed-precondition") {
      console.warn("[data] Thiếu index cho orderBy(createdAt), fallback không sắp xếp.");
      const fallback = includeInactive
        ? collection(db, COLLECTIONS.products)
        : query(collection(db, COLLECTIONS.products), where("active", "==", true));
      snapshot = await getDocs(fallback);
    } else {
      throw error;
    }
  }

  let products = snapshot.docs.map(mapProduct);
  if (featured === true) products = products.filter((product) => product.featured);
  return products;
}

/**
 * Đọc một sản phẩm theo id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function fetchProductById(id) {
  if (!id) return null;
  const snapshot = await getDoc(doc(db, COLLECTIONS.products, id));
  return snapshot.exists() ? mapProduct(snapshot) : null;
}

/**
 * Đọc danh mục đang bật (active !== false).
 * @returns {Promise<Array<object>>}
 */
export async function fetchCategories() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.categories));
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((category) => category.active !== false)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "vi"));
}

/**
 * Đọc đánh giá của một sản phẩm (sắp xếp mới nhất trước, xử lý ở client để
 * không cần composite index).
 * @param {string} productId
 * @returns {Promise<Array<object>>}
 */
export async function fetchReviews(productId) {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.reviews), where("productId", "==", productId))
  );
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

/**
 * Tạo một đánh giá mới cho sản phẩm.
 * @param {{productId: string, uid: string, userName: string, rating: number, comment: string}} payload
 */
export async function createReview(payload) {
  return addDoc(collection(db, COLLECTIONS.reviews), {
    productId: payload.productId,
    uid: payload.uid,
    userName: payload.userName || "Khách",
    rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
    comment: String(payload.comment || "").slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

/**
 * Đọc đơn hàng của chính người dùng đang đăng nhập.
 * @param {string} uid
 * @returns {Promise<Array<object>>}
 */
export async function fetchMyOrders(uid) {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.orders), where("uid", "==", uid))
  );
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}

/**
 * Tính điểm đánh giá trung bình.
 * @param {Array<{rating?: number}>} reviews
 * @returns {{average: number, count: number}}
 */
export function averageRating(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  if (!list.length) return { average: 0, count: 0 };
  const total = list.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return { average: Math.round((total / list.length) * 10) / 10, count: list.length };
}
