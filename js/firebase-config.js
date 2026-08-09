// ==========================================================================
// FIREBASE-CONFIG.JS
// Điểm khởi tạo Firebase DUY NHẤT của toàn bộ project.
//
// File này làm gì:
//   - Gọi initializeApp() một lần duy nhất.
//   - Export các instance dùng chung: app, auth, db, storage, analytics.
//   - Export lại các hằng số tên collection để tránh gõ sai chuỗi.
//
// File nào sử dụng nó:
//   js/auth.js, js/main.js, js/products.js, js/detail.js, js/cart.js,
//   js/checkout.js, js/orders.js, js/profile.js, js/admin.js,
//   components/header.js
//
// Firebase service được sử dụng:
//   Authentication, Cloud Firestore, Storage, Analytics (tuỳ chọn).
//
// Lưu ý bảo mật: Firebase Web API key KHÔNG phải secret, được phép nằm ở
// frontend. Việc bảo vệ dữ liệu phụ thuộc hoàn toàn vào Security Rules
// (xem firestore.rules và storage.rules).
// ==========================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBOwt2CpF5T9f5gigQLi4UIA0KcX7uM67c",
  authDomain: "khanhduy-3aa91.firebaseapp.com",
  projectId: "khanhduy-3aa91",
  storageBucket: "khanhduy-3aa91.firebasestorage.app",
  messagingSenderId: "471230011703",
  appId: "1:471230011703:web:2cfdb38f12ff95da08a2b2",
  measurementId: "G-2C049PNMY5"
};
// getApps() bảo đảm initializeApp() không bao giờ chạy hai lần, kể cả khi
// module bị load lại (ví dụ trong quá trình dev với live-reload).
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Tên các collection trong Firestore. Dùng hằng số để tránh sai chính tả.
export const COLLECTIONS = {
  users: "Users",
  products: "Products",
  categories: "Categories",
  carts: "Carts",
  orders: "Orders",
  reviews: "Reviews",
  settings: "Settings",
};

/**
 * Nạp Firebase Analytics một cách "lazy" và an toàn.
 * Analytics chỉ chạy được trên http/https (không chạy trên file://) nên hàm
 * này luôn bọc trong try/catch và trả về null nếu không khả dụng.
 * @returns {Promise<import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js").Analytics|null>}
 */
export async function loadAnalytics() {
  try {
    if (!location.protocol.startsWith("http")) return null;
    const { getAnalytics, isSupported } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js"
    );
    if (!(await isSupported())) return null;
    return getAnalytics(app);
  } catch (error) {
    console.warn("[firebase] Analytics không khả dụng:", error?.message || error);
    return null;
  }
}
