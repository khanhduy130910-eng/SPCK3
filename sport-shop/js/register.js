// ==========================================================================
// REGISTER.JS
// Script của trang đăng ký (register.html).
//
// File này làm gì:
//   - Kiểm tra dữ liệu nhập: họ tên, email, mật khẩu, nhập lại mật khẩu.
//   - Tạo tài khoản bằng createUserWithEmailAndPassword() (trong js/auth.js).
//   - Tạo document Users/{uid} với role mặc định "user".
//   - Cho phép đăng ký/đăng nhập nhanh bằng Google.
//
// File nào sử dụng nó: register.html
// Firebase service được sử dụng: Authentication + Cloud Firestore (Users).
// ==========================================================================

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { registerWithEmail, loginWithGoogle, waitForAuth } from "./auth.js";
import {
  reportError,
  setButtonLoading,
  showToast,
  validateEmail,
  validatePassword,
} from "./utils.js";

/** Điểm khởi động của trang đăng ký. */
async function initRegisterPage() {
  renderHeader();
  renderFooter();

  const { user } = await waitForAuth();
  if (user) {
    location.replace("index.html");
    return;
  }

  bindRegisterForm();
  bindGoogleButton();
}

/** Form đăng ký. */
function bindRegisterForm() {
  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("register-error");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (name.length < 2) {
      errorEl.textContent = "Họ tên phải có ít nhất 2 ký tự.";
      return;
    }
    if (!validateEmail(email)) {
      errorEl.textContent = "Email không hợp lệ.";
      return;
    }
    if (phone && !/^0\d{8,10}$/.test(phone)) {
      errorEl.textContent = "Số điện thoại không hợp lệ (ví dụ: 0901234567).";
      return;
    }
    const check = validatePassword(password);
    if (!check.valid) {
      errorEl.textContent = check.message;
      return;
    }
    if (password !== confirmPassword) {
      errorEl.textContent = "Mật khẩu nhập lại không khớp.";
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Đang tạo tài khoản...");
    try {
      await registerWithEmail({ name, email, password, phone });
      showToast("Tạo tài khoản thành công. Chào mừng bạn!", "success");
      location.replace("index.html");
    } catch (error) {
      errorEl.textContent = reportError("register/email", error, { silent: true });
      setButtonLoading(button, false);
    }
  });
}

/** Nút đăng ký nhanh bằng Google. */
function bindGoogleButton() {
  const button = document.getElementById("google-register");
  const errorEl = document.getElementById("register-error");
  button?.addEventListener("click", async () => {
    setButtonLoading(button, true, "Đang mở Google...");
    try {
      await loginWithGoogle();
      showToast("Đăng nhập Google thành công.", "success");
      location.replace("index.html");
    } catch (error) {
      errorEl.textContent = reportError("register/google", error, { silent: true });
      setButtonLoading(button, false);
    }
  });
}

initRegisterPage().catch((error) => reportError("register/init", error));
