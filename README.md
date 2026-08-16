# SPORTHUB — Website bán đồ thể thao (HTML + CSS + JS ES Modules + Firebase)

Website bán hàng hoàn chỉnh, không dùng framework frontend, không build step.
Toàn bộ dữ liệu nghiệp vụ nằm trên Firebase (Authentication, Cloud Firestore,
Storage). LocalStorage **không** được dùng để lưu giỏ hàng hay đơn hàng.

## Cấu trúc

```
index.html            Trang chủ (hero, danh mục, nổi bật, mới nhất, thời tiết, CTA)
login.html            Đăng nhập (email/mật khẩu, Google, quên mật khẩu)
register.html         Đăng ký
products.html         Danh sách sản phẩm: tìm kiếm, lọc, sắp xếp, phân trang
product-detail.html   Chi tiết sản phẩm (?id=PRODUCT_ID), đánh giá, sản phẩm liên quan
cart.html             Giỏ hàng realtime (Carts/{uid})
checkout.html         Thanh toán, tạo Orders/{orderId}
orders.html           Đơn hàng của tôi
profile.html          Hồ sơ, upload avatar lên Storage, đổi mật khẩu
admin.html            Quản trị: dashboard, products, categories, orders, users, reviews, settings
404.html              Trang không tìm thấy
css/                  style.css (storefront), admin.css (quản trị)
js/                   firebase-config, auth, utils, data, main, products, detail,
                      cart, checkout, orders, profile, admin, weather, chatbot, config
components/           header, navbar, footer, product-card, carousel, modal, toast, pagination
scripts/seed.html     Tiện ích nạp dữ liệu mẫu (chỉ admin)
scripts/sample-data.js 44 sản phẩm + 4 danh mục mẫu kèm ảnh thật (Unsplash)
firestore.rules       Security Rules cho Firestore
storage.rules         Security Rules cho Storage
firestore.indexes.json Composite index cho Products(active, createdAt)
firebase.json         Cấu hình Firebase Hosting + rules

```

Firebase được khởi tạo **đúng một lần** trong `js/firebase-config.js`; các file khác
chỉ import `auth`, `db`, `storage` từ đó.

## Chạy local

Cần một static server (module ES không chạy được với `file://`):

```bash
cd sport-shop
python3 -m http.server 5500
# mở http://localhost:5500/index.html
```

## Cấu hình phía Firebase Console (bắt buộc)

Code đã sẵn sàng, nhưng project Firebase cần các bước sau, nếu thiếu sẽ thấy lỗi
`Missing or insufficient permissions` hoặc không đăng nhập được:

1. **Authentication → Sign-in method**: bật **Email/Password** và **Google**.
2. **Authentication → Settings → Authorized domains**: thêm domain chạy web
   (`localhost` đã có sẵn; thêm domain hosting khi deploy).
3. **Firestore Database**: tạo database, sau đó deploy rules:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use khanhduy-3aa91
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
4. **Storage**: bật Storage cho project (bucket `khanhduy-3aa91.firebasestorage.app`).
5. **Tạo admin đầu tiên**: đăng ký một tài khoản trên website, rồi vào Firestore
   sửa `Users/{uid}.role` từ `user` thành `admin`. Sau đó `admin.html` mới mở được.
6. **Dữ liệu mẫu (tuỳ chọn)**: đăng nhập bằng admin và mở `scripts/seed.html`
   → nạp 4 danh mục + 44 sản phẩm có ảnh (bỏ qua bản ghi trùng tên).
7. **Analytics (tuỳ chọn)**: nếu chưa bật Firebase Installations/Analytics API,
   console sẽ log cảnh báo `installations/request-failed`. Cảnh báo này không ảnh
   hưởng Auth/Firestore/Storage; có thể bỏ `loadAnalytics()` trong `js/main.js`.

## Ảnh sản phẩm

- Firestore lưu `image` (ảnh chính) và `images[]` (danh sách ảnh). Chỉ cần một
  trong hai trường là hiển thị được; `primaryImage()` trong `js/utils.js` tự chọn
  ảnh đầu tiên.
- Admin → Products/Categories: dán URL ảnh (preview hiện ngay) hoặc upload lên
  Storage; cả hai đều lưu URL vào Firestore.
- Ảnh lỗi sẽ được thay bằng placeholder SVG thương hiệu (`bindImageFallback()`),
  không để ô trắng.

## Mô hình dữ liệu Firestore

| Collection   | Document | Field chính |
|--------------|----------|-------------|
| `Users`      | `{uid}`  | uid, name, email, role (`user`/`admin`), avatar, phone, address, disabled, createdAt, updatedAt |
| `Products`   | auto     | name, price, description, image, images[], category, stock, featured, active, specs{}, createdAt, updatedAt |
| `Categories` | auto     | name, slug, description, image, active, createdAt, updatedAt |
| `Carts`      | `{uid}`  | items[{productId, name, price, image, quantity}], updatedAt |
| `Orders`     | auto     | uid, products[], subtotal, shipping, total, customerName, phone, address, note, paymentMethod, status, createdAt, updatedAt |
| `Reviews`    | auto     | productId, uid, userName, rating (1–5), comment, createdAt |
| `Settings`   | `general`| storeName, hotline, email, address, freeShipThreshold, updatedAt |

Trạng thái đơn hàng: `pending` → `confirmed` → `shipping` → `completed`, hoặc `cancelled`.

## Bảo mật

- `firestore.rules`: user chỉ đọc/ghi profile, giỏ hàng, đơn hàng **của chính mình**;
  không tự sửa được `role`/`disabled`; chỉ admin quản trị Products/Categories/Orders/Users;
  không có rule `allow read, write: if true` cho dữ liệu riêng tư.
- `storage.rules`: avatar chỉ chính chủ ghi (≤ 2 MB, `image/*`); ảnh sản phẩm chỉ admin
  (≤ 5 MB); đường dẫn khác bị chặn.
- `admin.html` được bảo vệ bằng `requireAdmin()` (đọc lại role từ Firestore, không chỉ
  ẩn nút bằng JS) **và** bởi Security Rules ở phía server.
- Frontend chỉ chứa Firebase Web config (public theo thiết kế của Firebase). Không có
  service account, không có Admin SDK, không có API key bí mật.

## Giới hạn đã biết (không "giả vờ" có tính năng)

- **Khoá tài khoản**: client SDK không thể `disable` user ở tầng Firebase Authentication.
  Trang Admin → Users chỉ đặt cờ `disabled` trong Firestore; `js/auth.js` phát hiện cờ này
  và tự đăng xuất người dùng. Muốn khoá thật cần Cloud Functions + Admin SDK (chạy phía
  server, không đưa credential vào frontend).
- **Chatbot**: mặc định là chatbot FAQ nội bộ (kịch bản có sẵn), **không phải AI**. UI nói rõ
  điều này. Có thể bật Tawk.to hoặc Crisp bằng cách điền id trong `js/config.js`.
- **Thời tiết**: dùng Open-Meteo (không cần API key). Nếu muốn OpenWeatherMap, điền key
  trong `js/config.js` — lưu ý key trong frontend luôn công khai, nên hạn chế theo domain.
- **Newsletter** ở footer chỉ validate email; chưa có backend nhận email.
- **Tìm kiếm/lọc** thực hiện ở client sau khi đọc danh sách sản phẩm (phù hợp với quy mô
  vài trăm sản phẩm; lớn hơn nên dùng Algolia/Typesense hoặc phân trang cursor).
