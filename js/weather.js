// ==========================================================================
// WEATHER.JS
// Widget thời tiết trên trang chủ.
//
// File này làm gì:
//   - Xin quyền Geolocation, nếu bị từ chối thì dùng vị trí dự phòng.
//   - Gọi API thời tiết (open-meteo mặc định, hoặc OpenWeatherMap nếu có key).
//   - Hiển thị thành phố, nhiệt độ, mô tả, độ ẩm và icon.
//   - Có loading state và error state.
//
// File nào sử dụng nó: js/main.js (trang chủ index.html)
// Firebase service được sử dụng: không.
// Cấu hình: js/config.js -> WEATHER_CONFIG
// ==========================================================================

import { WEATHER_CONFIG } from "./config.js";
import { escapeHtml } from "./utils.js";

/** Mô tả + icon tương ứng với WMO weather code của open-meteo. */
const WMO_CODES = {
  0: { text: "Trời quang", icon: "☀️" },
  1: { text: "Nắng nhẹ", icon: "🌤️" },
  2: { text: "Có mây", icon: "⛅" },
  3: { text: "Nhiều mây", icon: "☁️" },
  45: { text: "Sương mù", icon: "🌫️" },
  48: { text: "Sương mù đóng băng", icon: "🌫️" },
  51: { text: "Mưa phùn nhẹ", icon: "🌦️" },
  53: { text: "Mưa phùn", icon: "🌦️" },
  55: { text: "Mưa phùn dày", icon: "🌦️" },
  61: { text: "Mưa nhẹ", icon: "🌧️" },
  63: { text: "Mưa", icon: "🌧️" },
  65: { text: "Mưa to", icon: "🌧️" },
  71: { text: "Tuyết nhẹ", icon: "🌨️" },
  73: { text: "Tuyết", icon: "🌨️" },
  75: { text: "Tuyết dày", icon: "🌨️" },
  80: { text: "Mưa rào", icon: "🌦️" },
  81: { text: "Mưa rào vừa", icon: "🌦️" },
  82: { text: "Mưa rào mạnh", icon: "⛈️" },
  95: { text: "Dông", icon: "⛈️" },
  96: { text: "Dông kèm mưa đá", icon: "⛈️" },
  99: { text: "Dông mạnh kèm mưa đá", icon: "⛈️" },
};

/**
 * Khởi tạo widget thời tiết trong container chỉ định.
 * @param {string} [containerId="weather-widget"]
 */
export async function initWeather(containerId = "weather-widget") {
  const container = document.getElementById(containerId);
  if (!container) return;

  renderLoading(container);

  try {
    const position = await getPosition();
    const weather =
      WEATHER_CONFIG.provider === "openweathermap" && WEATHER_CONFIG.openWeatherMapApiKey
        ? await fetchOpenWeatherMap(position)
        : await fetchOpenMeteo(position);
    renderWeather(container, weather);
  } catch (error) {
    console.error("[weather] Không lấy được dữ liệu thời tiết:", error);
    renderError(container);
  }
}

/**
 * Lấy toạ độ người dùng. Nếu bị từ chối/không hỗ trợ -> dùng fallbackLocation.
 * @returns {Promise<{latitude: number, longitude: number, city?: string}>}
 */
function getPosition() {
  const fallback = { ...WEATHER_CONFIG.fallbackLocation };
  if (!("geolocation" in navigator)) return Promise.resolve(fallback);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    navigator.geolocation.getCurrentPosition(
      (position) =>
        done({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => done(fallback),
      { timeout: 4000, maximumAge: 600000 }
    );
    // Bảo hiểm: một số trình duyệt không gọi callback nào cả (chờ quyền truy cập).
    setTimeout(() => done(fallback), 4500);
  });
}

/**
 * Gọi open-meteo (miễn phí, không cần API key).
 * @param {{latitude: number, longitude: number, city?: string}} position
 */
async function fetchOpenMeteo(position) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(position.latitude)}` +
    `&longitude=${encodeURIComponent(position.longitude)}` +
    "&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`open-meteo HTTP ${response.status}`);
  const payload = await response.json();
  const current = payload.current || {};
  const info = WMO_CODES[current.weather_code] || { text: "Không rõ", icon: "🌡️" };
  return {
    city: position.city || (await reverseGeocode(position)),
    temperature: Math.round(Number(current.temperature_2m)),
    description: info.text,
    icon: info.icon,
    humidity: Number(current.relative_humidity_2m),
  };
}

/**
 * Gọi OpenWeatherMap (cần API key trong WEATHER_CONFIG).
 * @param {{latitude: number, longitude: number, city?: string}} position
 */
async function fetchOpenWeatherMap(position) {
  const url =
    "https://api.openweathermap.org/data/2.5/weather" +
    `?lat=${encodeURIComponent(position.latitude)}` +
    `&lon=${encodeURIComponent(position.longitude)}` +
    `&units=metric&lang=${encodeURIComponent(WEATHER_CONFIG.language)}` +
    `&appid=${encodeURIComponent(WEATHER_CONFIG.openWeatherMapApiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`openweathermap HTTP ${response.status}`);
  const payload = await response.json();
  return {
    city: payload.name || position.city || "Vị trí của bạn",
    temperature: Math.round(Number(payload.main?.temp)),
    description: payload.weather?.[0]?.description || "Không rõ",
    iconUrl: payload.weather?.[0]?.icon
      ? `https://openweathermap.org/img/wn/${payload.weather[0].icon}@2x.png`
      : "",
    icon: "🌡️",
    humidity: Number(payload.main?.humidity),
  };
}

/**
 * Tìm tên thành phố từ toạ độ (API công khai, không cần key).
 * Nếu thất bại thì trả về nhãn chung chung.
 * @param {{latitude: number, longitude: number}} position
 * @returns {Promise<string>}
 */
async function reverseGeocode(position) {
  try {
    const url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client" +
      `?latitude=${encodeURIComponent(position.latitude)}` +
      `&longitude=${encodeURIComponent(position.longitude)}` +
      `&localityLanguage=${encodeURIComponent(WEATHER_CONFIG.language)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`geocode HTTP ${response.status}`);
    const payload = await response.json();
    return payload.city || payload.locality || payload.principalSubdivision || "Vị trí của bạn";
  } catch (error) {
    console.warn("[weather] Không xác định được tên thành phố:", error?.message || error);
    return "Vị trí của bạn";
  }
}

/** Loading state. */
function renderLoading(container) {
  container.innerHTML = `<div class="weather">
    <div class="skeleton weather__icon"></div>
    <div style="flex:1">
      <div class="skeleton skeleton-line skeleton-line--sm"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
    </div>
  </div>`;
}

/** Error state. */
function renderError(container) {
  container.innerHTML = `<div class="weather">
    <div class="weather__icon" style="font-size:44px">🌐</div>
    <div>
      <div class="weather__city">Không lấy được thời tiết</div>
      <div class="weather__desc">Kiểm tra kết nối mạng hoặc thử tải lại trang.</div>
    </div>
  </div>`;
}

/**
 * Render dữ liệu thời tiết.
 * @param {HTMLElement} container
 * @param {{city: string, temperature: number, description: string, icon: string, iconUrl?: string, humidity: number}} weather
 */
function renderWeather(container, weather) {
  const temperature = Number.isFinite(weather.temperature) ? weather.temperature : "--";
  const humidity = Number.isFinite(weather.humidity) ? `${weather.humidity}%` : "--";
  const iconHtml = weather.iconUrl
    ? `<img class="weather__icon" src="${escapeHtml(weather.iconUrl)}" alt="${escapeHtml(
        weather.description
      )}">`
    : `<div class="weather__icon" style="font-size:48px;line-height:64px;text-align:center">${weather.icon}</div>`;

  container.innerHTML = `<div class="weather fade-in">
    ${iconHtml}
    <div>
      <div class="weather__temp">${temperature}°C</div>
      <div class="weather__city">${escapeHtml(weather.city)}</div>
      <div class="weather__desc">${escapeHtml(weather.description)} · Độ ẩm ${humidity}</div>
    </div>
  </div>`;
}
