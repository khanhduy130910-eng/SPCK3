// ==========================================================================
// FOOTER.JS
// Component footer dùng chung cho mọi trang storefront.
//
// File này làm gì: render footer (liên kết, thông tin, form nhận tin) vào
//   phần tử #site-footer.
// File nào sử dụng nó: mọi trang storefront thông qua js/main.js hoặc script
//   riêng của trang.
// Firebase service được sử dụng: không.
// ==========================================================================

import { showToast, validateEmail } from "../js/utils.js";

/**
 * Render footer vào #site-footer.
 * @returns {HTMLElement|null}
 */
export function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return null;

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <a class="logo" href="index.html" style="color:#fff">SPORT<span>HUB</span></a>
            <p style="margin-top:var(--space-3);max-width:36ch">
              Cửa hàng thể thao trực tuyến: giày, quần áo và phụ kiện luyện tập.
              Thiết kế tối giản, tập trung vào hiệu năng.
            </p>
            <form class="newsletter" data-newsletter>
              <input class="input" type="email" name="email" placeholder="Email của bạn"
                aria-label="Email nhận tin" required>
              <button class="btn btn--light" type="submit">Đăng ký</button>
            </form>
            <ul class="footer-social" aria-label="Mạng xã hội">
              <li><a class="footer-social__link" href="https://facebook.com" target="_blank"
                rel="noopener noreferrer" aria-label="Facebook" title="Facebook">f</a></li>
              <li><a class="footer-social__link" href="https://instagram.com" target="_blank"
                rel="noopener noreferrer" aria-label="Instagram" title="Instagram">◎</a></li>
              <li><a class="footer-social__link" href="https://youtube.com" target="_blank"
                rel="noopener noreferrer" aria-label="YouTube" title="YouTube">▶</a></li>
              <li><a class="footer-social__link" href="https://tiktok.com" target="_blank"
                rel="noopener noreferrer" aria-label="TikTok" title="TikTok">♪</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer__title">Mua sắm</h4>
            <a class="footer__link" href="products.html">Tất cả sản phẩm</a>
            <a class="footer__link" href="products.html?sort=newest">Hàng mới về</a>
            <a class="footer__link" href="products.html?featured=1">Sản phẩm nổi bật</a>
            <a class="footer__link" href="cart.html">Giỏ hàng</a>
          </div>
          <div>
            <h4 class="footer__title">Tài khoản</h4>
            <a class="footer__link" href="login.html">Đăng nhập</a>
            <a class="footer__link" href="register.html">Đăng ký</a>
            <a class="footer__link" href="orders.html">Đơn hàng của tôi</a>
            <a class="footer__link" href="profile.html">Hồ sơ</a>
          </div>
          <div>
            <h4 class="footer__title">Liên hệ &amp; hỗ trợ</h4>
            <a class="footer__link" href="#chatbot">💬 Chat với chúng tôi</a>
            <a class="footer__link" href="mailto:support@sporthub.example">✉ support@sporthub.example</a>
            <a class="footer__link" href="tel:+842812345678">☎ 028 1234 5678</a>
            <span class="footer__link">📍 123 Nguyễn Văn Linh, Q.7, TP.HCM</span>
            <span class="footer__link">🕒 8:00 - 21:00 mỗi ngày</span>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} SPORTHUB. Dự án học tập, không liên quan tới bất kỳ thương hiệu nào.</span>
          <span>Made with HTML, CSS, JavaScript &amp; Firebase</span>
        </div>
      </div>
    </footer>`;

  // Form nhận tin chỉ validate phía client; chưa có backend gửi mail.
  mount.querySelector("[data-newsletter]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "");
    if (!validateEmail(email)) {
      showToast("Email không hợp lệ.", "error");
      return;
    }
    event.currentTarget.reset();
    showToast(
      "Đã ghi nhận email. (Tính năng gửi bản tin cần backend/dịch vụ email riêng.)",
      "info",
      4200
    );
  });

  return mount;
}
