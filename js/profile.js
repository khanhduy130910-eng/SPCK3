// ==========================================================================
// PROFILE.JS
// Script của trang hồ sơ người dùng (profile.html).
//
// File này làm gì:
//   - Bắt buộc đăng nhập trước khi người dùng có thể xem hoặc chỉnh sửa hồ sơ.
//   - Cho phép cập nhật tên, số điện thoại, địa chỉ trong collection Users/{uid}.
//   - Upload avatar lên Firebase Storage (avatars/{uid}/...) rồi lưu URL tương ứng
//     vào Firestore để các nơi khác lấy ra hiển thị.
//   - Có preview ảnh trước khi lưu và hiển thị tiến độ upload.
//   - Cho phép người dùng đổi mật khẩu sau khi xác thực lại bằng mật khẩu hiện tại.
//
// File nào sử dụng nó: profile.html
// Firebase service được sử dụng: Authentication + Cloud Firestore (Users)
//   + Storage (ảnh avatar).
//
// Luồng hoạt động tổng thể của file này:
//   1. profile.html load script này.
//   2. initProfilePage() chạy ngay lập tức.
//   3. requireAuth() kiểm tra user đang đăng nhập hay chưa.
//   4. Nếu đã đăng nhập, getCurrentProfile() lấy đối tượng profile từ Firestore.
//   5. renderProfileHead() vẽ phần tiêu đề hồ sơ và avatar ở đầu trang.
//   6. bindInfoForm() gắn sự kiện lưu thông tin cá nhân.
//   7. bindAvatarUpload() xử lý file ảnh upload từ máy tính.
//   8. bindAvatarUrl() xử lý dán link URL ảnh trực tiếp.
//   9. bindPasswordForm() xử lý đổi mật khẩu.
//   10. Tất cả dữ liệu cập nhật được ghi xuống Firestore và Auth metadata.
//
// Đặc điểm quan trọng:
//   - Đây là file xử lý riêng cho trang Hồ sơ, không dùng logic của các trang khác.
//   - Mỗi khi user thực hiện thao tác, file này đều tương tác trực tiếp với:
//       * Firebase Auth để lấy user hiện tại và cập nhật photoURL
//       * Firestore để lưu profile
//       * Firebase Storage để upload ảnh mới
//       * DOM để render lại giao diện sau khi lưu
// ==========================================================================

// --------------------------------------------------------------------------
// Khối import Firebase và utility.
// Mỗi import này có ý nghĩa khác nhau trong luồng hoạt động:
// - storageRef, uploadBytesResumable, getDownloadURL: dùng để upload file ảnh vào Storage.
// - updateProfile: dùng để cập nhật photoURL trong Auth user để header khác hiển thị avatar.
// - renderHeader, renderFooter: render phần gáy và chân trang chung của website.
// - storage: đối tượng Firebase Storage chuẩn được cấu hình sẵn từ firebase-config.js.
// - requireAuth, getCurrentProfile, updateOwnProfile, changePassword: các hàm làm việc với Auth & Firestore.
// - initChatbot: khởi tạo chatbot của trang.
// - escapeHtml, formatDate, getInitials, reportError, setButtonLoading, showToast, validatePassword:
//   là các helper dùng chung để render, hiển thị toast, báo lỗi và xử lý form.
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// Biến hằng số dùng chung cho upload avatar.
// MAX_AVATAR_SIZE = 2 MB nghĩa là kích thước ảnh tối đa mà người dùng có thể tải lên.
// Nếu vượt ngưỡng này, hệ thống sẽ từ chối và yêu cầu chọn lại ảnh khác.
// --------------------------------------------------------------------------
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

// --------------------------------------------------------------------------
// currentUser lưu trữ đối tượng user hiện tại từ Firebase Authentication.
// Giá trị này được gán trong initProfilePage() sau khi requireAuth() xác nhận user login.
// Nó được dùng để cập nhật photoURL bằng updateProfile(user, { photoURL: url }).
// --------------------------------------------------------------------------
let currentUser = null;

/**
 * Điểm khởi động của trang hồ sơ.
 *
 * Input:
 * - Không có tham số đầu vào.
 *
 * Output:
 * - Gắn header/footer/chatbot và bind toàn bộ form trên trang profile.
 *
 * Được gọi bởi:
 * - Tự chạy khi file profile.js được load ở profile.html.
 *
 * Ảnh hưởng tới:
 * - Toàn bộ giao diện và chức năng trên trang Hồ sơ.
 */
async function initProfilePage() {
  // Render header chính của website để phía trên trang luôn có thanh điều hướng chung.
  renderHeader();
  // Render footer ở cuối trang để tái sử dụng layout chuẩn của website.
  renderFooter();
  // Khởi tạo chatbot trên trang nếu hệ thống đã tích hợp trên toàn site.
  initChatbot();

  // requireAuth() đảm bảo user cần đăng nhập mới được vào trang profile.
  // Nếu chưa đăng nhập, hàm này trả về null và file dừng tiến độ.
  const session = await requireAuth();
  if (!session) return;

  // Gán user hiện tại để các hàm sau này dùng lại cho updateProfile/avatar.
  currentUser = session.user;
  // profile là dữ liệu người dùng được lưu trong Firestore (Users/{uid}).
  // Nếu không có thì dùng object rỗng để tránh crash ở render UI.
  const profile = getCurrentProfile() || {};
  // Render phần đầu của hồ sơ: avatar, tên, email, vai trò, thời gian tham gia.
  renderProfileHead(session.user, profile);
  // Gắn event cho form thông tin cá nhân.
  bindInfoForm(profile);
  // Gắn event cho upload avatar từ file trên máy tính.
  bindAvatarUpload(session.user);
  // Gắn event cho nhập URL ảnh trực tiếp từ internet.
  bindAvatarUrl(session.user);
  // Gắn event cho form đổi mật khẩu.
  bindPasswordForm();
}

/**
 * Kiểm tra URL ảnh có hợp lệ và an toàn để dùng trong thẻ <img>.
 *
 * Input:
 * - value: chuỗi URL người dùng nhập.
 *
 * Output:
 * - true nếu URL có giao thức http hoặc https
 * - false nếu URL rỗng, sai định dạng hoặc không phải http/https
 *
 * Được gọi bởi:
 * - bindAvatarUrl()
 *
 * Ảnh hưởng tới:
 * - Kiểm tra đầu vào trước khi save avatar từ URL.
 */
function isValidImageUrl(value) {
  // Cắt bỏ khoảng trắng thừa ở đầu/cuối vì người dùng có thể dán URL kèm dấu cách.
  const trimmed = value.trim();
  // Nếu chuỗi rỗng thì không hợp lệ.
  if (!trimmed) return false;
  try {
    // new URL() sẽ phân tích chuỗi URL theo chuẩn browser.
    const candidate = new URL(trimmed);
    // Chỉ cho phép http và https để ngăn đường dẫn file local hoặc scheme không hợp lệ.
    return ["http:", "https:"].includes(candidate.protocol);
  } catch (error) {
    // Nếu URL không hợp lệ, catch sẽ bắt lỗi và trả về false.
    return false;
  }
}

/**
 * Render phần đầu hồ sơ: avatar lớn, tên, email, vai trò và thời gian tham gia.
 *
 * Input:
 * - user: object user từ Firebase Auth
 * - profile: object profile từ Firestore
 *
 * Output:
 * - HTML string được gán vào `#profile-head`
 *
 * Được gọi bởi:
 * - initProfilePage()
 * - bindInfoForm() sau khi cập nhật hồ sơ thành công
 *
 * Ảnh hưởng tới:
 * - Header thông tin người dùng ở đầu trang Hồ sơ.
 */
function renderProfileHead(user, profile) {
  // Lấy phần tử DOM nơi đặt thông tin hồ sơ ở đầu trang.
  const head = document.getElementById("profile-head");
  // Nếu không tìm thấy element, dừng luôn vì không có chỗ để render.
  if (!head) return;
  // name ưu tiên lấy từ profile.name, nếu không có thì dùng user.displayName, nếu vẫn không có thì "Khách".
  const name = profile.name || user.displayName || "Khách";
  // avatar ưu tiên lấy từ profile.avatar, sau đó user.photoURL, nếu không có mới để trống.
  const avatar = profile.avatar || user.photoURL || "";
  // Gán HTML vào phần đầu profile. Nếu có avatar thì render thẻ <img>, nếu không thì render chữ cái đầu tên.
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
 * Gắn sự kiện và xử lý form cập nhật thông tin cá nhân.
 *
 * Input:
 * - profile: object chứa thông tin của user từ Firestore
 *
 * Output:
 * - Khi submit form thành công, Firestore sẽ được cập nhật.
 *
 * Được gọi bởi:
 * - initProfilePage()
 *
 * Ảnh hưởng tới:
 * - Dữ liệu cá nhân trong profile (họ tên, số điện thoại, địa chỉ).
 */
function bindInfoForm(profile) {
  // Lấy form có id profile-form từ DOM.
  const form = document.getElementById("profile-form");
  // Nếu form không tồn tại thì không cần gắn xử lý.
  if (!form) return;
  // Điền dữ liệu hiện tại từ Firestore vào các ô input để người dùng thấy dữ liệu đang có.
  form.name.value = profile.name || "";
  form.phone.value = profile.phone || "";
  form.address.value = profile.address || "";

  // Dùng event submit để bắt người dùng nhấn nút Lưu thay đổi.
  form.addEventListener("submit", async (event) => {
    // Ngăn form submit theo cách mặc định của browser để xử lý bằng JS.
    event.preventDefault();
    // Tìm nút submit để thay đổi trạng thái loading trong lúc đang lưu.
    const button = form.querySelector('button[type="submit"]');
    // Lấy giá trị đã nhập, trim bỏ khoảng trắng thừa ở đầu/cuối.
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();

    // Nếu họ tên quá ngắn thì không cho lưu.
    if (name.length < 2) {
      showToast("Họ tên phải có ít nhất 2 ký tự.", "warning");
      return;
    }
    // Số điện thoại nếu có thì phải đúng định dạng Việt Nam: bắt đầu bằng 0 và có 9-11 chữ số.
    if (phone && !/^0\d{8,10}$/.test(phone)) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    // Hiển thị trạng thái đang lưu trên nút submit.
    setButtonLoading(button, true, "Đang lưu...");
    try {
      // Gọi updateOwnProfile() để lưu dữ liệu cùng lúc cập nhật lại cache trong auth.js.
      const updated = await updateOwnProfile({ name, phone, address });
      // Cho biết lưu thành công bằng toast popup.
      showToast("Đã cập nhật hồ sơ.", "success");
      // Render lại phần header sau khi thông tin đã đổi để cập nhật tên nếu cần.
      renderProfileHead(currentUser, updated || {});
    } catch (error) {
      // Nếu có lỗi, báo lỗi vào hệ thống và hiển thị log để debug.
      reportError("profile/update", error);
    } finally {
      // Dù thành công hay thất bại thì phải tắt trạng thái loading.
      setButtonLoading(button, false);
    }
  });
}

/**
 * Xử lý upload avatar bằng file ảnh từ máy tính của người dùng.
 *
 * Input:
 * - user: đối tượng user đang đăng nhập từ Auth
 *
 * Output:
 * - File ảnh được upload lên Firebase Storage.
 * - URL tải xuống được lưu vào Firestore và đồng bộ lên Auth photoURL.
 *
 * Được gọi bởi:
 * - initProfilePage()
 *
 * Ảnh hưởng tới:
 * - Avatar trên trang Hồ sơ và các nơi hiển thị user avatar khác.
 */
function bindAvatarUpload(user) {
  // Lấy element input file để người dùng chọn ảnh từ máy tính.
  const input = document.getElementById("avatar-input");
  // Lấy khu vực preview ảnh sẽ hiển thị trước khi upload.
  const previewEl = document.getElementById("avatar-preview");
  // Progress wrap là khung hiển thị đường tiến độ upload.
  const progressWrap = document.getElementById("avatar-progress");
  // progressBar là thanh fill của tiến độ upload.
  const progressBar = document.getElementById("avatar-progress-bar");
  // uploadBtn là nút "Tải ảnh lên".
  const uploadBtn = document.getElementById("avatar-upload");
  // Nếu không có các phần tử này thì không làm gì cả.
  if (!input || !uploadBtn) return;

  // selectedFile lưu file ảnh đang được chọn nhưng chưa upload.
  let selectedFile = null;

  // Sự kiện change xảy ra khi người dùng chọn một file mới từ hộp thoại máy tính.
  input.addEventListener("change", () => {
    // Lấy file đầu tiên trong input file.
    const file = input.files?.[0];
    // Reset selectedFile mỗi khi người dùng chọn lại file mới.
    selectedFile = null;
    // Nếu không có file nào được chọn thì xóa preview cũ và dừng lại.
    if (!file) {
      if (previewEl) previewEl.innerHTML = "";
      return;
    }
    // Kiểm tra file thực sự là ảnh.
    if (!file.type.startsWith("image/")) {
      showToast("Vui lòng chọn một file ảnh.", "warning");
      // Xóa input để không lưu file không hợp lệ.
      input.value = "";
      return;
    }
    // Kiểm tra dung lượng file không quá 2 MB.
    if (file.size > MAX_AVATAR_SIZE) {
      showToast("Ảnh quá lớn (tối đa 2 MB).", "warning");
      input.value = "";
      return;
    }
    // Chỉ đến đây mới xác nhận file hợp lệ, lưu vào selectedFile.
    selectedFile = file;
    // Tạo URL object để preview ảnh ngay trên trang mà không cần upload lên server.
    if (previewEl) {
      const url = URL.createObjectURL(file);
      previewEl.innerHTML = `<div class="image-preview__item"><img src="${url}" alt="Xem trước avatar"></div>`;
    }
  });

  // Sự kiện click trên nút upload sẽ bắt đầu quá trình tải lên Firebase Storage.
  uploadBtn.addEventListener("click", () => {
    // Nếu chưa có file nào được chọn thì cảnh báo người dùng.
    if (!selectedFile) {
      showToast("Hãy chọn ảnh trước khi tải lên.", "warning");
      return;
    }
    // Lấy phần mở rộng tên file để lưu trong Storage theo định dạng avatars/{uid}/{timestamp}.{ext}.
    const extension = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
    // Đường dẫn lưu trên Firebase Storage. Ví dụ: avatars/uid/1712345678901.png
    const path = `avatars/${user.uid}/${Date.now()}.${extension}`;
    // uploadBytesResumable tạo task upload có thể theo dõi tiến độ, không cần chờ upload xong mới làm việc.
    const task = uploadBytesResumable(storageRef(storage, path), selectedFile, {
      contentType: selectedFile.type,
    });

    // Bật trạng thái loading và hiện thanh tiến độ upload.
    setButtonLoading(uploadBtn, true, "Đang tải lên...");
    progressWrap?.classList.remove("hidden");

    // .on("state_changed", ...) theo dõi từng phần dữ liệu upload.
    task.on(
      "state_changed",
      // callback đầu tiên chạy khi tiến độ upload thay đổi.
      (snapshot) => {
        // Tính phần trăm trong khoảng 0-100 dựa trên bytes đã upload so với tổng bytes cần upload.
        const percent = Math.round(
          (snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100
        );
        // Cập nhật chiều rộng thanh progress bar theo phần trăm.
        if (progressBar) progressBar.style.width = `${percent}%`;
      },
      // callback lỗi khi upload bị hủy hoặc lỗi mạng / quyền truy cập.
      (error) => {
        setButtonLoading(uploadBtn, false);
        progressWrap?.classList.add("hidden");
        reportError("profile/avatarUpload", error);
      },
      // callback thành công, tức upload đã hoàn tất và file đã có trên Storage.
      async () => {
        try {
          // Lấy URL download có thể dùng cho thẻ <img>.
          const url = await getDownloadURL(task.snapshot.ref);
          // Lưu URL của ảnh vào Firestore profile.avatar.
          await updateOwnProfile({ avatar: url });
          try {
          // Cập nhật photoURL trong Firebase Auth để các phần khác của hệ thống hiển thị avatar đồng nhất.
          await updateProfile(user, { photoURL: url });
          } catch (error) {
          // Không phải lúc nào cũng update được Auth photoURL, nên chỉ cảnh báo chứ không làm crash UI.
          console.warn("[profile] Không cập nhật được photoURL của Auth:", error);
          }
          // Thông báo cho người dùng biết upload thành công.
          showToast("Đã cập nhật ảnh đại diện.", "success");
          // Cập nhật phần avatar ở đầu trang profile ngay lập tức bằng các thay mới nhất.
          const slot = document.getElementById("avatar-slot");
          if (slot) {
          slot.innerHTML = `<img class="avatar avatar--lg" src="${escapeHtml(
            url
          )}" alt="Ảnh đại diện">`;
          }
          // Xóa preview vì ảnh đã được lưu thành công.
          if (previewEl) previewEl.innerHTML = "";
          // Xóa input file sau khi upload xong để chuẩn bị cho lần chọn tiếp theo.
          input.value = "";
          // Reset selectedFile về null để tránh upload lại cùng file mà không cần chọn lại.
          selectedFile = null;
        } catch (error) {
          // Nếu lưu Firestore hoặc render lại giao diện bị lỗi thì báo lỗi.
          reportError("profile/avatarSave", error);
        } finally {
          // Tắt loading dù lỗi hay thành công.
          setButtonLoading(uploadBtn, false);
          progressWrap?.classList.add("hidden");
          // Reset thanh tiến độ về 0 cho lần upload tiếp theo.
          if (progressBar) progressBar.style.width = "0";
        }
      }
    );
  });
}

/**
 * Lưu avatar trực tiếp từ URL bên ngoài, không cần tải lên Firebase Storage.
 *
 * Input:
 * - user: thông tin user hiện tại
 *
 * Output:
 * - Nếu URL hợp lệ, Firestore sẽ lưu chuỗi URL trực tiếp vào profile.avatar.
 *
 * Được gọi bởi:
 * - initProfilePage()
 *
 * Ảnh hưởng tới:
 * - Đưa ảnh đại diện từ mạng vào website mà không cần upload file local.
 */
function bindAvatarUrl(user) {
  // Lấy ô input dành riêng cho URL ảnh.
  const input = document.getElementById("avatar-url");
  // Lấy nút "Dùng URL" để người dùng bấm lưu ảnh từ link.
  const button = document.getElementById("avatar-url-apply");
  // Lấy khu vực preview ảnh để hiển thị trước khi lưu.
  const previewEl = document.getElementById("avatar-preview");
  // Nếu input hoặc nút không tồn tại thì không thực hiện gì.
  if (!input || !button) return;

  // Event click của nút Dùng URL.
  button.addEventListener("click", async () => {
    // Lấy giá trị nhập vào, bỏ khoảng trắng ở đầu/cuối.
    const url = input.value.trim();
    // Gọi hàm kiểm tra URL hợp lệ: chỉ chấp nhận http/https.
    if (!isValidImageUrl(url)) {
      showToast("URL ảnh không hợp lệ. Vui lòng dùng định dạng https://...", "warning");
      return;
    }

    try {
      // Khi dùng URL trực tiếp, xóa lựa chọn file cũ nếu trước đó người dùng đã chọn ảnh từ máy tính.
      const fileInput = document.getElementById("avatar-input");
      if (fileInput) fileInput.value = "";
      // Hiển thị preview từ URL mới để người dùng thấy ảnh đang dùng trước khi lưu.
      if (previewEl) {
        previewEl.innerHTML = `<div class="image-preview__item"><img src="${escapeHtml(url)}" alt="Xem trước avatar URL"></div>`;
      }

      // Lưu trực tiếp URL vào profile.avatar trong Firestore theo cùng cơ chế với ảnh upload từ Storage.
      await updateOwnProfile({ avatar: url });
      try {
        // Nếu Auth user cũng có photoURL thì cập nhật để đồng bộ với toàn hệ thống.
        await updateProfile(user, { photoURL: url });
      } catch (error) {
        // Không phải lúc nào cũng cập nhật được, nên chỉ log cảnh báo chứ không phá vỡ UI.
        console.warn("[profile] Không cập nhật được photoURL từ URL:", error);
      }

      // Cập nhật avatar ở đầu hồ sơ hiện tại bằng URL mới này.
      const slot = document.getElementById("avatar-slot");
      if (slot) {
        slot.innerHTML = `<img class="avatar avatar--lg" src="${escapeHtml(url)}" alt="Ảnh đại diện">`;
      }
      // Thông báo lưu thành công.
      showToast("Đã lưu ảnh đại diện từ URL.", "success");
      // Xóa trường input URL sau khi lưu thành công để form sạch lại.
      input.value = "";
    } catch (error) {
      // Nếu lưu Firestore bị lỗi thì reportError để ghi log và hiển thị cảnh báo hệ thống.
      reportError("profile/avatarUrlSave", error);
    }
  });
}

/**
 * Form đổi mật khẩu.
 *
 * Input:
 * - currentPassword: mật khẩu hiện tại của người dùng
 * - newPassword: mật khẩu mới
 * - confirmPassword: xác nhận mật khẩu mới
 *
 * Output:
 * - Nếu hợp lệ, Firebase Authentication sẽ cập nhật mật khẩu mới.
 *
 * Được gọi bởi:
 * - initProfilePage()
 *
 * Ảnh hưởng tới:
 * - Quyền đăng nhập của người dùng, không ảnh hưởng đến dữ liệu profile khác.
 */
function bindPasswordForm() {
  // Lấy form đổi mật khẩu từ DOM.
  const form = document.getElementById("password-form");
  // Nếu form không tồn tại thì dừng.
  if (!form) return;

  // Sự kiện submit bắt người dùng nhấn nút Đổi mật khẩu.
  form.addEventListener("submit", async (event) => {
    // Chặn hành vi submit mặc định của browser để xử lý bằng JS.
    event.preventDefault();
    // Lấy nút submit để bật loading.
    const button = form.querySelector('button[type="submit"]');
    // Lấy giá trị người dùng nhập cho từng field.
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    // validatePassword() kiểm tra độ mạnh của mật khẩu mới.
    const check = validatePassword(newPassword);
    if (!check.valid) {
      showToast(check.message, "warning");
      return;
    }
    // Nếu mật khẩu mới và mật khẩu xác nhận không khớp thì không cho lưu.
    if (newPassword !== confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp.", "warning");
      return;
    }

    // Bật trạng thái loading trong lúc đổi mật khẩu.
    setButtonLoading(button, true, "Đang đổi...");
    try {
      // changePassword() sẽ xác thực lại bằng password hiện tại, rồi cập nhật password mới.
      await changePassword(currentPassword, newPassword);
      // reset form để người dùng thấy dữ liệu mới đã được xóa sạch.
      form.reset();
      showToast("Đã đổi mật khẩu thành công.", "success");
    } catch (error) {
      // Nếu đổi mật khẩu thất bại do sai mật khẩu hoặc lỗi khác thì báo lỗi.
      reportError("profile/changePassword", error);
    } finally {
      // Dù thành công hay thất bại, loading luôn phải tắt.
      setButtonLoading(button, false);
    }
  });
}

// --------------------------------------------------------------------------
// Bước cuối cùng của file: khởi động trang profile khi script load xong.
// Nếu có lỗi trong quá trình khởi tạo, reportError() sẽ ghi log để kiểm tra.
// --------------------------------------------------------------------------
initProfilePage().catch((error) => reportError("profile/init", error));
