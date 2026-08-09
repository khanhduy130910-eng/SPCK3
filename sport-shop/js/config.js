// ==========================================================================
// CONFIG.JS
// Tập trung các biến cấu hình của tích hợp bên ngoài (thời tiết, chatbot).
//
// File này làm gì: khai báo rõ ràng những giá trị cần điền để bật các tính
//   năng phụ thuộc dịch vụ bên thứ ba. Chỉ đặt ở đây các giá trị KHÔNG phải
//   secret (API key public / widget id). Tuyệt đối không đặt private key,
//   service account hay API secret thật vào frontend.
//
// File nào sử dụng nó: js/weather.js, js/chatbot.js
// Firebase service được sử dụng: không.
// ==========================================================================

/**
 * Cấu hình widget thời tiết.
 *
 * provider:
 *   - "open-meteo": mặc định, KHÔNG cần API key, hoạt động ngay.
 *   - "openweathermap": cần điền openWeatherMapApiKey (key public của OWM).
 */
export const WEATHER_CONFIG = {
  provider: "open-meteo",
  // Điền API key của OpenWeatherMap nếu muốn dùng provider "openweathermap".
  // Để trống nếu dùng open-meteo.
  openWeatherMapApiKey: "",
  // Vị trí dự phòng khi người dùng từ chối Geolocation.
  fallbackLocation: {
    city: "Thành phố Hồ Chí Minh",
    latitude: 10.7769,
    longitude: 106.7009,
  },
  language: "vi",
};

/**
 * Cấu hình chatbot.
 *
 * provider:
 *   - "local": chỉ dùng UI + luật trả lời sẵn có (không phải AI). Mặc định.
 *   - "tawk": nhúng Tawk.to, cần propertyId và widgetId.
 *   - "crisp": nhúng Crisp, cần websiteId.
 *
 * LƯU Ý: khi provider = "local", chatbot KHÔNG phải AI. Nó chỉ trả lời theo
 * một tập câu hỏi thường gặp đã định nghĩa trước trong js/chatbot.js.
 */
export const CHATBOT_CONFIG = {
  provider: "local",
  tawk: {
    propertyId: "", // ví dụ: "5f1a2b3c4d5e6f7g8h9i0j"
    widgetId: "default",
  },
  crisp: {
    websiteId: "", // ví dụ: "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6"
  },
};
