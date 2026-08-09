// ==========================================================================
// AUTH.JS
// Toàn bộ logic tài khoản: đăng ký, đăng nhập (email + Google), đăng xuất,
// quên mật khẩu, theo dõi trạng thái đăng nhập và phân quyền user/admin.
//
// File này làm gì:
//   - Tạo/đọc document Users/{uid} trong Firestore.
//   - Cung cấp onUserChanged() để mọi trang lắng nghe user + profile.
//   - requireAuth() / requireAdmin() dùng để chặn truy cập trang.
//
// File nào sử dụng nó: login.html, register.html, components/header.js,
//   js/main.js, js/cart.js, js/checkout.js, js/orders.js, js/profile.js,
//   js/admin.js, js/detail.js
//
// Firebase service được sử dụng: Authentication + Cloud Firestore.
// ==========================================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db, COLLECTIONS } from "./firebase-config.js";

/** Cache profile của user hiện tại để không phải đọc Firestore nhiều lần. */
let currentUser = null;
let currentProfile = null;
let authReady = false;
const readyWaiters = [];
const listeners = new Set();

/**
 * Giá trị mặc định của một document Users/{uid}.
 * @param {import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").User} user
 * @param {{name?: string, phone?: string, address?: string}} [extra]
 */
function defaultUserDoc(user, extra = {}) {
  return {
    uid: user.uid,
    name: extra.name || user.displayName || (user.email || "").split("@")[0] || "Khách",
    email: user.email || "",
    role: "user",
    avatar: user.photoURL || "",
    phone: extra.phone || user.phoneNumber || "",
    address: extra.address || "",
    disabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Đảm bảo Users/{uid} tồn tại. Nếu chưa có thì tạo mới với role "user".
 * Không bao giờ ghi đè field role của document đã tồn tại.
 * @param {import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").User} user
 * @param {{name?: string, phone?: string, address?: string}} [extra]
 * @returns {Promise<object>} profile
 */
export async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const data = defaultUserDoc(user, extra);
    await setDoc(ref, data);
    return { ...data, id: user.uid };
  }
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Đọc profile Users/{uid}. Trả về null nếu không đọc được (ví dụ bị rules chặn).
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function fetchUserProfile(uid) {
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.users, uid));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    console.error("[auth] Không đọc được profile:", error);
    return null;
  }
}

// --------------------------------------------------------------------------
// Theo dõi trạng thái đăng nhập
// --------------------------------------------------------------------------

// Một listener duy nhất cho toàn app; các trang đăng ký callback qua onUserChanged().
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  currentProfile = null;

  if (user) {
    try {
      currentProfile = await ensureUserDoc(user);
      // Tài khoản bị admin khoá trong Firestore: đăng xuất ngay.
      if (currentProfile?.disabled === true) {
        await signOut(auth);
        currentUser = null;
        currentProfile = null;
        sessionStorage.setItem("authNotice", "Tài khoản của bạn đã bị khoá.");
        location.href = "login.html";
        return;
      }
    } catch (error) {
      console.error("[auth] Lỗi khi nạp profile:", error);
    }
  }

  authReady = true;
  while (readyWaiters.length) readyWaiters.shift()();
  listeners.forEach((callback) => {
    try {
      callback(currentUser, currentProfile);
    } catch (error) {
      console.error("[auth] Lỗi trong listener:", error);
    }
  });
});

/**
 * Đăng ký callback nhận (user, profile). Nếu trạng thái auth đã sẵn sàng,
 * callback được gọi ngay lập tức.
 * @param {(user: object|null, profile: object|null) => void} callback
 * @returns {() => void} hàm huỷ đăng ký
 */
export function onUserChanged(callback) {
  listeners.add(callback);
  if (authReady) callback(currentUser, currentProfile);
  return () => listeners.delete(callback);
}

/**
 * Chờ tới khi Firebase xác định xong trạng thái đăng nhập.
 * @returns {Promise<{user: object|null, profile: object|null}>}
 */
export function waitForAuth() {
  if (authReady) return Promise.resolve({ user: currentUser, profile: currentProfile });
  return new Promise((resolve) => {
    readyWaiters.push(() => resolve({ user: currentUser, profile: currentProfile }));
  });
}

/** @returns {object|null} user của Firebase Auth (hoặc null). */
export function getCurrentUser() {
  return currentUser;
}

/** @returns {object|null} document Users/{uid} đã cache. */
export function getCurrentProfile() {
  return currentProfile;
}

/** Cập nhật cache profile sau khi trang profile/admin sửa dữ liệu. */
export function setCurrentProfile(profile) {
  currentProfile = profile;
  listeners.forEach((callback) => callback(currentUser, currentProfile));
}

/** @returns {boolean} true nếu user hiện tại là admin. */
export function isAdmin() {
  return currentProfile?.role === "admin";
}

// --------------------------------------------------------------------------
// Các hành động tài khoản
// --------------------------------------------------------------------------

/**
 * Đăng ký tài khoản mới bằng email/mật khẩu rồi tạo Users/{uid}.
 * @param {{name: string, email: string, password: string, phone?: string}} payload
 * @returns {Promise<object>} profile vừa tạo
 */
export async function registerWithEmail({ name, email, password, phone = "" }) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return ensureUserDoc(credential.user, { name: name?.trim(), phone });
}

/**
 * Đăng nhập bằng email/mật khẩu.
 * @param {string} email
 * @param {string} password
 */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserDoc(credential.user);
}

/**
 * Đăng nhập bằng Google (popup). Tự tạo Users/{uid} nếu là lần đầu.
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return ensureUserDoc(credential.user);
}

/** Đăng xuất khỏi Firebase Authentication. */
export async function logout() {
  await signOut(auth);
}

/**
 * Gửi email đặt lại mật khẩu.
 * @param {string} email
 */
export async function sendResetEmail(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Đổi mật khẩu: xác thực lại bằng mật khẩu hiện tại rồi cập nhật mật khẩu mới.
 * Chỉ áp dụng cho tài khoản đăng nhập bằng email/password.
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export async function changePassword(currentPassword, newPassword) {
  if (!currentUser) throw new Error("Bạn chưa đăng nhập.");
  const hasPasswordProvider = currentUser.providerData.some(
    (provider) => provider.providerId === "password"
  );
  if (!hasPasswordProvider) {
    throw new Error(
      "Tài khoản này đăng nhập bằng Google nên không có mật khẩu để đổi."
    );
  }
  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
}

/**
 * Cập nhật một phần document Users/{uid} của chính người dùng.
 * Không cho phép sửa role/disabled từ phía user thường (rules cũng chặn).
 * @param {Record<string, unknown>} data
 */
export async function updateOwnProfile(data) {
  if (!currentUser) throw new Error("Bạn chưa đăng nhập.");
  const payload = { ...data };
  delete payload.role;
  delete payload.disabled;
  delete payload.uid;
  delete payload.createdAt;
  payload.updatedAt = serverTimestamp();
  await updateDoc(doc(db, COLLECTIONS.users, currentUser.uid), payload);
  currentProfile = { ...(currentProfile || {}), ...payload };
  listeners.forEach((callback) => callback(currentUser, currentProfile));
  return currentProfile;
}

// --------------------------------------------------------------------------
// Bảo vệ trang
// --------------------------------------------------------------------------

/**
 * Bắt buộc đã đăng nhập. Nếu chưa, chuyển sang login.html kèm redirect.
 * @returns {Promise<{user: object, profile: object|null}|null>}
 */
export async function requireAuth() {
  const { user, profile } = await waitForAuth();
  if (!user) {
    const redirect = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.href = `login.html?redirect=${redirect}`;
    return null;
  }
  return { user, profile };
}

/**
 * Bắt buộc là admin. Kiểm tra role trong Firestore (không chỉ ẩn nút bằng JS).
 * Nếu không phải admin: chuyển về index.html.
 * @returns {Promise<{user: object, profile: object}|null>}
 */
export async function requireAdmin() {
  const { user } = await waitForAuth();
  if (!user) {
    location.href = `login.html?redirect=${encodeURIComponent("admin.html")}`;
    return null;
  }
  // Đọc lại trực tiếp từ Firestore để chắc chắn role là dữ liệu mới nhất.
  const profile = await fetchUserProfile(user.uid);
  if (!profile || profile.role !== "admin") {
    sessionStorage.setItem("authNotice", "Bạn không có quyền truy cập trang quản trị.");
    location.href = "index.html";
    return null;
  }
  currentProfile = profile;
  return { user, profile };
}
