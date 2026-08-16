// ==========================================================================
// WEATHER.JS
// Widget thời tiết dạng chip ở góc phải header.
//
// File này làm gì:
//   - Xin quyền Geolocation, nếu bị từ chối thì dùng vị trí dự phòng.
//   - Gọi API thời tiết (open-meteo mặc định, hoặc OpenWeatherMap nếu có key).
//   - Hiển thị nhiệt độ + thành phố + icon (mobile chỉ còn icon + nhiệt độ).
//   - Có loading state và error state.
//
// File nào sử dụng nó: components/header.js (mọi trang storefront)
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

/** Loading state (chip xám nhẹ). */
function renderLoading(container) {
  container.innerHTML = `<div class="weather-chip weather-chip--loading" aria-busy="true"
    aria-label="Đang tải thời tiết">
    <span class="weather-chip__icon">🌡️</span>
    <span class="weather-chip__body">
      <span class="skeleton skeleton-line skeleton-line--sm"></span>
      <span class="skeleton skeleton-line skeleton-line--md"></span>
    </span>
  </div>`;
}

/** Error state. */
function renderError(container) {
  container.innerHTML = `<div class="weather-chip weather-chip--error"
    title="Không lấy được thời tiết. Kiểm tra kết nối mạng hoặc tải lại trang.">
    <span class="weather-chip__icon">🌐</span>
    <span class="weather-chip__body">
      <strong class="weather-chip__temp">--°</strong>
      <small class="weather-chip__meta">Không có thời tiết</small>
    </span>
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
  const city = escapeHtml(weather.city || "Vị trí của bạn");
  const description = escapeHtml(weather.description || "");
  const iconHtml = weather.iconUrl
    ? `<img class="weather-chip__icon" src="${escapeHtml(weather.iconUrl)}" alt="${description}">`
    : `<span class="weather-chip__icon" aria-hidden="true">${weather.icon}</span>`;

  container.innerHTML = `<div class="weather-chip fade-in"
    title="${city} · ${description} · Độ ẩm ${humidity}"
    aria-label="Thời tiết ${city}: ${temperature} độ C, ${description}">
    ${iconHtml}
    <span class="weather-chip__body">
      <strong class="weather-chip__temp">${temperature}°C</strong>
      <small class="weather-chip__meta">${city} · ${description}</small>
    </span>
  </div>`;
}
