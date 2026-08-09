// ==========================================================================
// LOGIN.JS
// Script của trang đăng nhập (login.html).
//
// File này làm gì:
//   - Đăng nhập bằng email + mật khẩu.
//   - Đăng nhập bằng Google.
//   - Quên mật khẩu (gửi email đặt lại).
//   - Nếu đã đăng nhập sẵn thì chuyển hướng luôn.
//   - Hỗ trợ tham số ?redirect=... để quay lại trang trước đó.
//
// File nào sử dụng nó: login.html
// Firebase service được sử dụng: Authentication (+ Firestore qua ensureUserDoc).
// ==========================================================================

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import {
  loginWithEmail,
  loginWithGoogle,
  sendResetEmail,
  waitForAuth,
} from "./auth.js";
import {
  getUrlParams,
  reportError,
  setButtonLoading,
  showToast,
  validateEmail,
} from "./utils.js";

/** Trang sẽ chuyển tới sau khi đăng nhập thành công. */
function redirectTarget() {
  const { redirect } = getUrlParams();
  if (!redirect) return "index.html";
  // Chỉ cho phép đường dẫn nội bộ, tránh open redirect.
  if (/^https?:|^\/\//i.test(redirect)) return "index.html";
  return redirect;
}

/** Điểm khởi động của trang đăng nhập. */
async function initLoginPage() {
  renderHeader();
  renderFooter();

  const { user } = await waitForAuth();
  if (user) {
    location.replace(redirectTarget());
    return;
  }

  bindLoginForm();
  bindGoogleButton();
  bindForgotPassword();
}

/** Form đăng nhập email/mật khẩu. */
function bindLoginForm() {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!validateEmail(email)) {
      errorEl.textContent = "Email không hợp lệ.";
      return;
    }
    if (!password) {
      errorEl.textContent = "Vui lòng nhập mật khẩu.";
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Đang đăng nhập...");
    try {
      await loginWithEmail(email, password);
      showToast("Đăng nhập thành công.", "success");
      location.replace(redirectTarget());
    } catch (error) {
      errorEl.textContent = reportError("login/email", error, { silent: true });
      setButtonLoading(button, false);
    }
  });
}

/** Nút đăng nhập bằng Google. */
function bindGoogleButton() {
  const button = document.getElementById("google-login");
  const errorEl = document.getElementById("login-error");
  button?.addEventListener("click", async () => {
    setButtonLoading(button, true, "Đang mở Google...");
    try {
      await loginWithGoogle();
      showToast("Đăng nhập Google thành công.", "success");
      location.replace(redirectTarget());
    } catch (error) {
      errorEl.textContent = reportError("login/google", error, { silent: true });
      setButtonLoading(button, false);
    }
  });
}

/** Liên kết quên mật khẩu. */
function bindForgotPassword() {
  const link = document.getElementById("forgot-password");
  const form = document.getElementById("login-form");
  link?.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = (form?.email.value || "").trim() || window.prompt("Nhập email của bạn:") || "";
    if (!validateEmail(email.trim())) {
      showToast("Hãy nhập email hợp lệ trước khi đặt lại mật khẩu.", "warning");
      return;
    }
    try {
      await sendResetEmail(email.trim());
      showToast("Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư của bạn.", "success", 5000);
    } catch (error) {
      reportError("login/reset", error);
    }
  });
}

initLoginPage().catch((error) => reportError("login/init", error));
