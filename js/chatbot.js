// ==========================================================================
// CHATBOT.JS
// Khu vực chat hỗ trợ khách hàng.
//
// File này làm gì:
//   - provider "local" (mặc định): render UI chat hoàn chỉnh và trả lời bằng
//     một tập luật FAQ định nghĩa sẵn. ĐÂY KHÔNG PHẢI AI — không có API nào
//     được gọi, và UI ghi rõ điều đó cho người dùng.
//   - provider "tawk" / "crisp": nhúng script của dịch vụ live-chat tương ứng
//     (cần điền id trong js/config.js).
//
// File nào sử dụng nó: js/main.js (trang chủ), có thể gọi ở mọi trang.
// Firebase service được sử dụng: không.
// Cấu hình: js/config.js -> CHATBOT_CONFIG
// ==========================================================================

import { CHATBOT_CONFIG } from "./config.js";
import { escapeHtml, showToast } from "./utils.js";

/** Bộ luật FAQ cho chế độ "local". Mỗi luật gồm từ khoá và câu trả lời. */
const FAQ_RULES = [
  {
    keywords: ["giao hàng", "vận chuyển", "ship", "phí"],
    answer:
      "Đơn từ 1.000.000 ₫ được miễn phí vận chuyển. Dưới mức đó phí là 30.000 ₫. Thời gian giao 2-5 ngày làm việc.",
  },
  {
    keywords: ["đổi", "trả", "hoàn tiền", "bảo hành"],
    answer:
      "Bạn có thể đổi/trả trong 30 ngày nếu sản phẩm còn nguyên tem và chưa qua sử dụng.",
  },
  {
    keywords: ["thanh toán", "cod", "chuyển khoản", "momo"],
    answer:
      "Hiện hỗ trợ: COD (thanh toán khi nhận hàng) và chuyển khoản ngân hàng. Chọn ở bước thanh toán.",
  },
  {
    keywords: ["size", "cỡ", "số", "chân"],
    answer:
      "Bảng size nằm trong phần Thông số của từng sản phẩm. Nếu bạn nằm giữa hai size, nên chọn size lớn hơn.",
  },
  {
    keywords: ["đơn hàng", "tra cứu", "trạng thái", "khi nào"],
    answer:
      "Bạn xem trạng thái đơn tại trang Đơn hàng (orders.html) sau khi đăng nhập.",
  },
  {
    keywords: ["tài khoản", "mật khẩu", "đăng nhập", "quên"],
    answer:
      "Nếu quên mật khẩu, dùng liên kết \"Quên mật khẩu\" ở trang đăng nhập để nhận email đặt lại.",
  },
];

const QUICK_QUESTIONS = [
  "Phí giao hàng thế nào?",
  "Chính sách đổi trả?",
  "Có những cách thanh toán nào?",
  "Làm sao xem đơn hàng của tôi?",
];

/**
 * Khởi tạo chatbot theo provider trong cấu hình.
 */
export function initChatbot() {
  const provider = CHATBOT_CONFIG.provider;
  if (provider === "tawk") {
    loadTawk();
    return;
  }
  if (provider === "crisp") {
    loadCrisp();
    return;
  }
  renderLocalChat();
}

/**
 * Nhúng Tawk.to. Nếu chưa cấu hình id thì fallback về chat nội bộ.
 */
function loadTawk() {
  const { propertyId, widgetId } = CHATBOT_CONFIG.tawk;
  if (!propertyId) {
    console.warn("[chatbot] Chưa cấu hình CHATBOT_CONFIG.tawk.propertyId — dùng chat nội bộ.");
    renderLocalChat();
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://embed.tawk.to/${propertyId}/${widgetId || "default"}`;
  script.charset = "UTF-8";
  script.setAttribute("crossorigin", "*");
  script.addEventListener("error", () => {
    console.error("[chatbot] Không tải được Tawk.to — dùng chat nội bộ.");
    renderLocalChat();
  });
  document.head.appendChild(script);
}

/**
 * Nhúng Crisp. Nếu chưa cấu hình websiteId thì fallback về chat nội bộ.
 */
function loadCrisp() {
  const { websiteId } = CHATBOT_CONFIG.crisp;
  if (!websiteId) {
    console.warn("[chatbot] Chưa cấu hình CHATBOT_CONFIG.crisp.websiteId — dùng chat nội bộ.");
    renderLocalChat();
    return;
  }
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = websiteId;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://client.crisp.chat/l.js";
  script.addEventListener("error", () => {
    console.error("[chatbot] Không tải được Crisp — dùng chat nội bộ.");
    renderLocalChat();
  });
  document.head.appendChild(script);
}

/**
 * Render UI chat nội bộ (nút nổi + panel) và gắn logic trả lời theo FAQ.
 */
function renderLocalChat() {
  if (document.getElementById("chat-toggle")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "chatbot";
  wrapper.innerHTML = `
    <button class="chat-toggle" id="chat-toggle" type="button"
      aria-label="Mở hộp chat hỗ trợ" aria-expanded="false">💬</button>
    <section class="chat-panel" id="chat-panel" aria-label="Hỗ trợ khách hàng">
      <div class="chat-panel__head">
        <div>
          <div class="chat-panel__title">Hỗ trợ SPORTHUB</div>
          <div style="font-size:11px;opacity:.75">Trả lời tự động theo câu hỏi thường gặp</div>
        </div>
        <button class="icon-btn" type="button" data-chat-close aria-label="Đóng chat"
          style="color:#fff">✕</button>
      </div>
      <div class="chat-panel__body" id="chat-body"></div>
      <div class="chat-quick" id="chat-quick"></div>
      <form class="chat-panel__foot" id="chat-form">
        <input class="input" type="text" name="message" placeholder="Nhập câu hỏi..."
          autocomplete="off" aria-label="Nội dung câu hỏi">
        <button class="btn btn--sm" type="submit">Gửi</button>
      </form>
    </section>`;
  document.body.appendChild(wrapper);

  const toggle = wrapper.querySelector("#chat-toggle");
  const panel = wrapper.querySelector("#chat-panel");
  const body = wrapper.querySelector("#chat-body");
  const quick = wrapper.querySelector("#chat-quick");
  const form = wrapper.querySelector("#chat-form");

  const openPanel = (open) => {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) form.querySelector("input").focus();
  };

  toggle.addEventListener("click", () => openPanel(!panel.classList.contains("is-open")));
  wrapper.querySelector("[data-chat-close]").addEventListener("click", () => openPanel(false));

  appendMessage(
    body,
    "Xin chào! Đây là trợ lý trả lời tự động (không phải AI). Chọn một câu hỏi bên dưới hoặc nhập câu hỏi của bạn.",
    "bot"
  );

  quick.innerHTML = QUICK_QUESTIONS.map(
    (question) => `<button class="chip" type="button">${escapeHtml(question)}</button>`
  ).join("");
  quick.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => handleQuestion(body, chip.textContent || ""));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    handleQuestion(body, message);
  });

  // Link "#chatbot" ở footer sẽ mở panel chat.
  document.querySelectorAll('a[href="#chatbot"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openPanel(true);
    });
  });
}

/**
 * Xử lý một câu hỏi: hiện tin nhắn người dùng rồi tìm câu trả lời theo từ khoá.
 * @param {HTMLElement} body
 * @param {string} question
 */
function handleQuestion(body, question) {
  appendMessage(body, question, "me");
  const answer = findAnswer(question);
  setTimeout(() => appendMessage(body, answer, "bot"), 280);
}

/**
 * Tìm câu trả lời phù hợp nhất trong FAQ_RULES.
 * @param {string} question
 * @returns {string}
 */
function findAnswer(question) {
  const normalized = question.toLowerCase();
  const matched = FAQ_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );
  if (matched) return matched.answer;
  return "Mình chưa có câu trả lời sẵn cho câu hỏi này. Bạn có thể gửi email tới support@sporthub.example hoặc gọi 028 1234 5678.";
}

/**
 * Thêm một tin nhắn vào khung chat.
 * @param {HTMLElement} body
 * @param {string} text
 * @param {"me"|"bot"} who
 */
function appendMessage(body, text, who) {
  const message = document.createElement("div");
  message.className = `chat-msg ${who === "me" ? "chat-msg--me" : ""}`;
  message.textContent = text;
  body.appendChild(message);
  body.scrollTop = body.scrollHeight;
}

/**
 * Mở chat từ bên ngoài (ví dụ nút CTA "Cần tư vấn?").
 */
export function openChat() {
  const panel = document.getElementById("chat-panel");
  if (!panel) {
    showToast("Chat chưa sẵn sàng, vui lòng thử lại.", "warning");
    return;
  }
  panel.classList.add("is-open");
}
