# WORKFLOW_EXPLAINED

## 1. Mục tiêu tổng quan của dự án

Dự án này là một storefront thời trang/thể thao chạy trên frontend và Firebase. Chức năng chính của hệ thống bao gồm:

- Hiển thị danh mục và sản phẩm trên trang chủ.
- Tìm kiếm, lọc, sắp xếp sản phẩm trong trang danh sách.
- Xem chi tiết từng sản phẩm.
- Quản lý giỏ hàng và tiến hành thanh toán.
- Đăng ký, đăng nhập, lưu hồ sơ người dùng.
- Xem lịch sử đơn hàng.
- Quản trị sản phẩm, danh mục, đơn hàng, người dùng bằng trang admin.

Toàn bộ dữ liệu sản phẩm, profile, đơn hàng, giỏ hàng, danh mục và đánh giá đều được lưu trong Firebase Firestore. Hình ảnh có thể lưu trên Firebase Storage hoặc là URL trực tiếp từ bên ngoài.

---

## 2. Cấu trúc thư mục và vai trò từng phần

### 2.1. Thư mục gốc

- `index.html`: trang chủ của website.
- `products.html`: trang danh sách sản phẩm.
- `product-detail.html`: trang chi tiết một sản phẩm.
- `cart.html`: trang giỏ hàng.
- `checkout.html`: trang thanh toán.
- `orders.html`: trang lịch sử đơn hàng.
- `profile.html`: trang cá nhân và avatar.
- `login.html`, `register.html`: trang xác thực người dùng.
- `admin.html`: giao diện quản trị dành cho admin.
- `404.html`: trang lỗi 404.

### 2.2. Thư mục `js/`

- `firebase-config.js`: khởi tạo Firebase, export `auth`, `db`, `storage`, collection names.
- `auth.js`: quản lý vòng đời tài khoản, role user/admin, cache profile.
- `data.js`: tất cả truy vấn Firestore liên quan đến sản phẩm, danh mục, review và đơn hàng.
- `cart.js`: quản lý giỏ hàng realtime và thao tác cập nhật số lượng / xoá.
- `checkout.js`: tạo đơn hàng từ giỏ hàng.
- `orders.js`: hiển thị và huỷ đơn hàng của người dùng.
- `profile.js`: chỉnh sửa profile, avatar, đổi mật khẩu.
- `main.js`: trang chủ, render blocks và load dữ liệu sản phẩm/danh mục.
- `products.js`: logic lọc and page danh sách sản phẩm.
- `detail.js`: render trang chi tiết + gallery + review + related products.
- `admin.js`: CRUD sản phẩm, danh mục, đơn hàng, user, review.
- `utils.js`: tập hợp utility dùng chung: format tiền, escape HTML, validate, fallback ảnh, toast, error.
- `weather.js`: widget thời tiết ở header.
- `chatbot.js`: trợ lý chat nội bộ hoặc tích hợp bên thứ ba.
- `config.js`: cấu hình chatbot và weather.

### 2.3. Thư mục `components/`

- `header.js`: render header chung trên mọi trang.
- `navbar.js`: render menu desktop và drawer mobile.
- `footer.js`: render footer và form nhận tin.
- `product-card.js`: component card sản phẩm dùng lại ở nhiều nơi.
- `pagination.js`: phân trang dạng component.
- `modal.js`: modal dùng cho admin hoặc xác nhận.
- `toast.js`: popup thông báo ngắn.
- `carousel.js`: carousel promo trên trang chủ.

---

## 3. Luồng chạy tổng thể của website

### 3.1. Khi người dùng mở trang chủ

1. Browser load `index.html`.
2. HTML chứa các phần rỗng để render header, footer và danh mục/sản phẩm.
3. `js/main.js` được tải bằng `type="module"`.
4. `main.js` gọi:
   - `renderHeader()` từ `components/header.js`
   - `renderFooter()` từ `components/footer.js`
   - `initCarousel()` từ `components/carousel.js`
   - `initChatbot()` từ `js/chatbot.js`
   - `loadAnalytics()` nếu có môi trường hỗ trợ
   - `loadCategories()` và `loadProducts()`
5. `loadCategories()` gọi `fetchCategories()` trong `js/data.js` để lấy dữ liệu danh mục từ Firestore.
6. `loadProducts()` gọi `fetchProducts({ limit: 48 })` để lấy sản phẩm có `active === true`.
7. Kết quả được render ra các container bằng `renderProductGrid()` từ `components/product-card.js`.
8. `primaryImage()` và `bindImageFallback()` đảm bảo ảnh luôn có fallback khi mất hình hoặc URL lỗi.

### 3.2. Khi người dùng truy cập trang sản phẩm

1. `products.html` load và chạy `js/products.js`.
2. `initProductsPage()`:
   - render header/footer
   - gắn sự kiện tìm kiếm, lọc, sắp xếp
   - đọc query string như `?q=`, `?category=`, `?sort=`
   - tải danh mục trong filter
   - tải toàn bộ sản phẩm
3. `fetchProducts()` đọc Firestore và trả về mảng product đã được chuẩn hoá.
4. `renderProductGrid()` render từng thẻ sản phẩm mà không reload trang.
5. `state` object giữ trạng thái filter hiện tại để hoàn toàn chạy ở client.
6. Khi người dùng thay đổi bộ lọc, `applyFilters()` sẽ lọc, sắp xếp và phân trang lại.

### 3.3. Khi người dùng vào chi tiết sản phẩm

1. `product-detail.html?id=...` được mở.
2. `js/detail.js` chạy `initDetailPage()`.
3. `getUrlParams()` đọc `id` từ URL.
4. `fetchProductById(id)` gọi Firestore `Products/{id}`.
5. Nếu sản phẩm tồn tại, `renderDetail()` tạo HTML cho gallery, thông tin giá, tồn kho, mô tả, tabs.
6. Nút thumbnail sẽ đổi hình ảnh chính trong gallery.
7. `loadReviews(product.id)` lấy đánh giá của sản phẩm từ `Reviews` collection.
8. `loadRelated(product)` lấy sản phẩm cùng danh mục để render ở phần “Sản phẩm liên quan”.
9. `addToCart()` được gắn vào nút thêm vào giỏ; nếu chưa đăng nhập thì chuyển hướng sang login.

### 3.4. Khi người dùng đăng nhập/đăng ký

1. `login.html` hoặc `register.html` chạy `js/login.js` hoặc `js/register.js`.
2. `auth.js` là trung tâm xác thực:
   - `registerWithEmail()` gọi Firebase Auth.
   - `loginWithEmail()` / `loginWithGoogle()` xử lý đăng nhập.
   - `ensureUserDoc()` tạo document `Users/{uid}` nếu chưa có.
3. `onAuthStateChanged(auth, ...)` theo dõi trạng thái đăng nhập trên toàn ứng dụng.
4. Mỗi khi auth state thay đổi, các listener như `renderHeader()` / `subscribeCart()` / `requireAuth()` sẽ nhận biết và cập nhật UI.
5. `requireAuth()` và `requireAdmin()` giữ vai trò chặn truy cập trang người dùng và trang admin nếu không hợp lệ.

### 3.5. Khi người dùng thêm sản phẩm vào giỏ

1. `addToCart(product, qty, button)` trong `js/cart.js` sẽ:
   - kiểm tra user đăng nhập
   - kiểm tra còn hàng hay không
   - đọc giỏ hàng hiện tại từ Firestore `Carts/{uid}`
   - gộp số lượng nếu sản phẩm đã có
   - lưu lại bằng `setDoc(...)`
2. `subscribeCart(callback)` đăng ký realtime listener trên giỏ hàng; header badge sẽ tự cập nhật ngay khi data thay đổi.
3. `cartTotals(items)` tính tổng số lượng, subtotal, shipping, total.

### 3.6. Khi người dùng đặt hàng

1. `checkout.html` chạy `js/checkout.js`.
2. `requireAuth()` đảm bảo người dùng phải đăng nhập.
3. `getCartItems(uid)` đọc giỏ hàng hiện tại.
4. `formEl.addEventListener("submit", ...)` validate thông tin nhận hàng.
5. `addDoc(collection(db, COLLECTIONS.orders), payload)` lưu đơn hàng mới vào collection `Orders`.
6. Sau khi thành công, `clearCart(user.uid)` xoá giỏ hàng.
7. Người dùng được chuyển tới `orders.html?new=<id>`.

### 3.7. Khi người dùng xem đơn hàng

1. `orders.html` chạy `js/orders.js`.
2. `fetchMyOrders(uid)` lấy danh sách đơn theo `uid` của user hiện tại.
3. `render()` lọc theo trạng thái và phân trang.
4. Nút huỷ đơn chỉ enable khi `status === "pending"`.
5. `updateDoc(doc(db, COLLECTIONS.orders, orderId), { status: "cancelled" })` cập nhật trạng thái.

### 3.8. Khi người dùng truy cập admin

1. `admin.html` load `js/admin.js`.
2. `initAdmin()` gọi `requireAdmin()`.
3. `requireAdmin()` đọc document `Users/{uid}` lại từ Firestore, kiểm tra `role === "admin"`.
4. Nếu đúng, UI admin hiện ra.
5. Trang admin có router dựa trên `location.hash` và render từng mục:
   - dashboard
   - products
   - categories
   - orders
   - users
   - reviews
   - settings
6. Dữ liệu được đọc bằng `getData()` và cache lại tại client để không phải query nhiều lần.
7. Tất cả thao tác CRUD đều tương tác trực tiếp với Firestore và Storage.

---

## 4. Mối quan hệ giữa các module

### 4.1. Mối quan hệ dữ liệu chính

```text
Browser UI
  │
  ├── components/header.js
  │      ├── js/auth.js  -> theo dõi user và role
  │      └── js/cart.js  -> realtime badge giỏ hàng
  │
  ├── js/main.js / js/products.js / js/detail.js
  │      ├── js/data.js -> đọc Firestore (Products, Categories, Reviews)
  │      ├── components/product-card.js -> render card sản phẩm
  │      └── js/utils.js -> escape, format, fallback image
  │
  ├── js/checkout.js
  │      ├── js/cart.js -> lấy giỏ hàng + clear cart
  │      └── js/auth.js -> xác thực user
  │
  ├── js/orders.js
  │      └── js/data.js -> fetchMyOrders(uid)
  │
  └── js/admin.js
          ├── js/auth.js -> requireAdmin()
          ├── js/firebase-config.js -> db, storage
          └── Firebase Storage / Firestore -> CRUD toàn bộ dữ liệu
```

### 4.2. Mối quan hệ dữ liệu Firebase

```text
Firestore
  ├── Users/{uid}
  │    ├── name, email, phone, address, role, avatar, disabled
  │    └── dùng cho auth + profile + admin access
  │
  ├── Products/{id}
  │    ├── name, price, description, stock, category, featured, active
  │    ├── image, imageUrl, images[]
  │    └── specs, createdAt, updatedAt
  │
  ├── Categories/{id}
  │    └── name, slug, image, active
  │
  ├── Carts/{uid}
  │    └── items[]
  │
  ├── Orders/{id}
  │    └── products[], customerName, address, status, total, uid, paymentMethod
  │
  ├── Reviews/{id}
  │    └── productId, uid, rating, comment, createdAt
  │
  └── Settings/{key}
       └── cấu hình cửa hàng
```

### 4.3. Hệ thống ảnh

Ảnh trong dự án có 3 nhánh dữ liệu chính:

- `imageUrl`: trường ưu tiên mới, đồng bộ với dữ liệu mới nhất.
- `image`: trường cũ để tương thích với dữ liệu cũ.
- `images[]`: mảng ảnh, ảnh đầu tiên thường là ảnh chính.

`js/utils.js` chứa `primaryImage()` để chọn ảnh ưu tiên. Điều này giúp UI không bị vỡ khi dữ liệu Firestore thiếu một trong các trường trên.

---

## 5. Luồng dữ liệu đi qua từng file

### 5.1. `firebase-config.js`

- Khởi tạo Firebase app duy nhất.
- Export `auth`, `db`, `storage`, `COLLECTIONS`.
- Đây là điểm khởi đầu để mọi file khác truy cập Firebase.

### 5.2. `auth.js`

- Là “trái tim” của phần đăng nhập và phân quyền.
- Chịu trách nhiệm:
  - tạo profile user đầu tiên
  - giữ cache user/profile
  - cung cấp `waitForAuth()`, `onUserChanged()`, `requireAuth()`, `requireAdmin()`
  - cập nhật `Users/{uid}`

### 5.3. `data.js`

- Là lớp data access layer cho toàn dự án.
- Các hàm như `fetchProducts()`, `fetchCategories()`, `fetchProductById()`, `fetchReviews()`, `fetchMyOrders()` trích xuất dữ liệu từ Firestore.
- Mỗi hàm chuẩn hoá dữ liệu để UI nhận được định dạng rõ ràng, dễ render.

### 5.4. `utils.js`

- Là “bộ công cụ” của toàn website.
- Chứa các chức năng chung như:
  - format dữ liệu tiền tệ và thời gian
  - escape HTML để an toàn khi render bằng innerHTML
  - validate email / password
  - fallback placeholder hình ảnh
  - toast / modal / error reporting

### 5.5. `components/`

- Tạo lại phần giao diện dùng chung trên nhiều trang.
- Không làm logic nghiệp vụ sâu, nhưng là nơi UI render tích hợp với auth / cart / search / navigation.

### 5.6. `admin.js`

- Là module quản trị mạnh nhất trong hệ thống.
- Kết nối trực tiếp với Firestore, Storage và các collection chính.
- Giữ cache dữ liệu để tránh việc reload lại liên tục trong các tab quản trị.

---

## 6. Tóm tắt ngắn gọn về luồng thực tế

Nếu rút gọn lại theo dạng “đường đi trong đời sống của một request người dùng” thì luồng như sau:

```text
Mở website
  -> index.html / products.html / product-detail.html
  -> JS chạy init function
  -> render header/footer + navigation/UX widgets
  -> fetch dữ liệu từ Firestore thông qua data.js
  -> render UI bằng template HTML
  -> user tương tác (click, search, add-to-cart, checkout, login...)
  -> auth.js / cart.js / data.js / admin.js cập nhật Firestore
  -> UI re-render hoặc badge/alert cập nhật theo realtime
```

Điểm mấu chốt là: người dùng không tương tác trực tiếp với Firestore. Tất cả đều đi qua các file JS trung gian (`auth.js`, `data.js`, `cart.js`, `admin.js`, `utils.js`) để bảo vệ dạng dữ liệu, chuẩn hóa đầu vào và tích hợp với UI.

---

## 7. Ghi chú về chất lượng code và sự dễ duy trì

- Mỗi module có trách nhiệm rõ ràng và không chồng chéo quá mức.
- `utils.js` tập trung các helper dùng chung.
- `firebase-config.js` tập trung cấu hình Firebase.
- `auth.js` là nguồn sự thật cho trạng thái user hiện tại.
- `data.js` là nơi truy cập dữ liệu sản phẩm và đơn hàng.
- `components/*` là phần UI dùng lại, giúp giữ tính nhất quán trên nhiều trang.
- `primaryImage()` và `bindImageFallback()` là các lớp bảo vệ quan trọng để không bị lỗi ảnh trên website.

Thực chất, dự án này là một ứng dụng frontend hiện đại, đơn giản nhưng rõ rắn về module hóa: UI -> Component -> Service layer -> Firebase.
