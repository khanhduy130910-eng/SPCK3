// ==========================================================================
// PROFILE.JS
// Script của trang hồ sơ người dùng (profile.html).
//
// File này làm gì:
//   - Bắt buộc đăng nhập.
//   - Cho phép đổi tên, số điện thoại, địa chỉ (ghi vào Users/{uid}).
//   - Upload avatar lên Firebase Storage (avatars/{uid}/...) rồi lưu URL vào
//     Firestore; có preview và progress bar.
//   - Đổi mật khẩu (yêu cầu xác thực lại bằng mật khẩu hiện tại).
//
// File nào sử dụng nó: profile.html
// Firebase service được sử dụng: Authentication + Cloud Firestore (Users)
//   + Storage (ảnh avatar).
// ==========================================================================

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";
import { storage } from "./firebase-config.js";
import {
  requireAuth,
  getCurrentProfile,
  updateOwnProfile,
  changePassword,
} from "./auth.js";
import { initChatbot } from "./chatbot.js";
import {
  escapeHtml,
  formatDate,
  getInitials,
  reportError,
  setButtonLoading,
  showToast,
  validatePassword,
} from "./utils.js";

/** Kích thước tối đa của avatar (2 MB). */
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

/** User Firebase Auth đang đăng nhập. */
let currentUser = null;

/** Điểm khởi động của trang hồ sơ. */
async function initProfilePage() {
  renderHeader();
  renderFooter();
  initChatbot();

  const session = await requireAuth();
  if (!session) return;

  currentUser = session.user;
  const profile = getCurrentProfile() || {};
  renderProfileHead(session.user, profile);
  bindInfoForm(profile);
  bindAvatarUpload(session.user);
  bindPasswordForm();
}

/**
 * Render khối thông tin tổng quan phía trên.
 * @param {object} user
 * @param {object} profile
 */
function renderProfileHead(user, profile) {
  const head = document.getElementById("profile-head");
  if (!head) return;
  const name = profile.name || user.displayName || "Khách";
  const avatar = profile.avatar || user.photoURL || "";
  head.innerHTML = `
    <div id="avatar-slot">
      ${
        avatar
          ? `<img class="avatar avatar--lg" src="${escapeHtml(avatar)}" alt="${escapeHtml(
              name
            )}">`
          : `<span class="avatar avatar--lg avatar--initials">${escapeHtml(
              getInitials(name)
            )}</span>`
      }
    </div>
    <div>
      <h1 style="margin-bottom:var(--space-1)">${escapeHtml(name)}</h1>
      <div class="text-muted">${escapeHtml(user.email || "")}</div>
      <div class="text-muted" style="font-size:var(--fs-sm)">
        Vai trò: <strong>${escapeHtml(profile.role || "user")}</strong> ·
        Tham gia: ${formatDate(profile.createdAt)}
      </div>
    </div>`;
}

/**
 * Form cập nhật thông tin cá nhân.
 * @param {object} profile
 */
function bindInfoForm(profile) {
  const form = document.getElementById("profile-form");
  if (!form) return;
  form.name.value = profile.name || "";
  form.phone.value = profile.phone || "";
  form.address.value = profile.address || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();

    if (name.length < 2) {
      showToast("Họ tên phải có ít nhất 2 ký tự.", "warning");
      return;
    }
    if (phone && !/^0\d{8,10}$/.test(phone)) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    setButtonLoading(button, true, "Đang lưu...");
    try {
      const updated = await updateOwnProfile({ name, phone, address });
      showToast("Đã cập nhật hồ sơ.", "success");
      renderProfileHead(currentUser, updated || {});
    } catch (error) {
      reportError("profile/update", error);
    } finally {
      setButtonLoading(button, false);
    }
  });
}

/**
 * Upload avatar lên Storage với preview + progress, sau đó lưu URL vào Firestore.
 * @param {object} user
 */
function bindAvatarUpload(user) {
  const input = document.getElementById("avatar-input");
  const previewEl = document.getElementById("avatar-preview");
  const progressWrap = document.getElementById("avatar-progress");
  const progressBar = document.getElementById("avatar-progress-bar");
  const uploadBtn = document.getElementById("avatar-upload");
  if (!input || !uploadBtn) return;

  let selectedFile = null;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    selectedFile = null;
    if (!file) {
      if (previewEl) previewEl.innerHTML = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("Vui lòng chọn một file ảnh.", "warning");
      input.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      showToast("Ảnh quá lớn (tối đa 2 MB).", "warning");
      input.value = "";
      return;
    }
    selectedFile = file;
    if (previewEl) {
      const url = URL.createObjectURL(file);
      previewEl.innerHTML = `<div class="image-preview__item"><img src="${url}" alt="Xem trước avatar"></div>`;
    }
  });

  uploadBtn.addEventListener("click", () => {
    if (!selectedFile) {
      showToast("Hãy chọn ảnh trước khi tải lên.", "warning");
      return;
    }
    const extension = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `avatars/${user.uid}/${Date.now()}.${extension}`;
    const task = uploadBytesResumable(storageRef(storage, path), selectedFile, {
      contentType: selectedFile.type,
    });

    setButtonLoading(uploadBtn, true, "Đang tải lên...");
    progressWrap?.classList.remove("hidden");

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100
        );
        if (progressBar) progressBar.style.width = `${percent}%`;
      },
      (error) => {
        setButtonLoading(uploadBtn, false);
        progressWrap?.classList.add("hidden");
        reportError("profile/avatarUpload", error);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          await updateOwnProfile({ avatar: url });
          try {
            await updateProfile(user, { photoURL: url });
          } catch (error) {
            console.warn("[profile] Không cập nhật được photoURL của Auth:", error);
          }
          showToast("Đã cập nhật ảnh đại diện.", "success");
          const slot = document.getElementById("avatar-slot");
          if (slot) {
            slot.innerHTML = `<img class="avatar avatar--lg" src="${escapeHtml(
              url
            )}" alt="Ảnh đại diện">`;
          }
          if (previewEl) previewEl.innerHTML = "";
          input.value = "";
          selectedFile = null;
        } catch (error) {
          reportError("profile/avatarSave", error);
        } finally {
          setButtonLoading(uploadBtn, false);
          progressWrap?.classList.add("hidden");
          if (progressBar) progressBar.style.width = "0";
        }
      }
    );
  });
}

/** Form đổi mật khẩu. */
function bindPasswordForm() {
  const form = document.getElementById("password-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    const check = validatePassword(newPassword);
    if (!check.valid) {
      showToast(check.message, "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp.", "warning");
      return;
    }

    setButtonLoading(button, true, "Đang đổi...");
    try {
      await changePassword(currentPassword, newPassword);
      form.reset();
      showToast("Đã đổi mật khẩu thành công.", "success");
    } catch (error) {
      reportError("profile/changePassword", error);
    } finally {
      setButtonLoading(button, false);
    }
  });
}

initProfilePage().catch((error) => reportError("profile/init", error));
