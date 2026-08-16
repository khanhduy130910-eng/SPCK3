// ==========================================================================
// SAMPLE-DATA.JS
// Dữ liệu mẫu (danh mục + sản phẩm) dùng cho scripts/seed.html.
//
// File này làm gì: khai báo danh sách danh mục và 34 sản phẩm mẫu kèm URL ảnh
//   thật (Unsplash - miễn phí, hotlink được) để website có ảnh ngay sau khi seed.
// File nào sử dụng nó: scripts/seed.html
// Firebase service được sử dụng: không (chỉ là dữ liệu tĩnh).
// ==========================================================================

/**
 * Tạo URL ảnh Unsplash đã tối ưu kích thước.
 * @param {string} id phần "photo-..." của Unsplash
 * @param {number} [width=900]
 * @returns {string}
 */
function img(id, width = 900) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;
}

/** Danh mục mẫu. */
export const SAMPLE_CATEGORIES = [
  {
    name: "Giày",
    description: "Giày chạy bộ, tập gym và sneaker thể thao.",
    image: img("1600185365483-26d7a4cc7519", 800),
  },
  {
    name: "Áo",
    description: "Áo tập, áo bóng đá, áo gym thoáng khí.",
    image: img("1521572163474-6864f9cf17ab", 800),
  },
  {
    name: "Quần",
    description: "Quần jogger, short thể thao, legging.",
    image: img("1594633312681-425c7b97ccd1", 800),
  },
  {
    name: "Phụ kiện",
    description: "Balo, bình nước, găng tay, đồng hồ, bóng.",
    image: img("1553062407-98eeb64c6a62", 800),
  },
];

/**
 * Sản phẩm mẫu.
 * @type {Array<{name: string, category: string, price: number, stock: number,
 *   featured: boolean, description: string, images: string[], specs: Record<string, string>}>}
 */
export const SAMPLE_PRODUCTS = [
  // ------------------------------ GIÀY ------------------------------
  {
    name: "Nike Air Max 90",
    category: "Giày",
    price: 3290000,
    stock: 24,
    featured: true,
    description:
      "Đệm Air ở gót cho cảm giác êm suốt ngày dài, upper phối da lộn và mesh thoáng khí. Phù hợp đi lại hằng ngày và tập nhẹ.",
    images: [img("1600185365483-26d7a4cc7519"), img("1549298916-b41d501d3772")],
    specs: { "Chất liệu": "Da lộn + mesh", "Đế": "Cao su, đệm Air", "Bảo hành": "6 tháng" },
  },
  {
    name: "Nike Air Zoom Pegasus 40",
    category: "Giày",
    price: 3590000,
    stock: 18,
    featured: true,
    description:
      "Giày chạy bộ hằng ngày với đệm ReactX phản hồi nhanh, ôm chân và nhẹ. Thích hợp cho cả chạy dài và interval.",
    images: [img("1542291026-7eec264c27ff"), img("1460353581641-37baddab0fa2")],
    specs: { "Trọng lượng": "255 g", "Độ chênh gót": "10 mm", "Bảo hành": "6 tháng" },
  },
  {
    name: "Nike Air Force 1 Pastel",
    category: "Giày",
    price: 2890000,
    stock: 16,
    featured: false,
    description:
      "Phiên bản pastel của mẫu sneaker kinh điển. Da tổng hợp mềm, đế cao su bền, dễ phối trang phục.",
    images: [img("1595950653106-6c9ebd614d3a")],
    specs: { "Chất liệu": "Da tổng hợp", "Kiểu": "Low top" },
  },
  {
    name: "Nike Dunk Low Retro",
    category: "Giày",
    price: 3190000,
    stock: 12,
    featured: true,
    description:
      "Thiết kế hai tông màu retro, cổ thấp gọn gàng, lót đệm êm. Streetwear và chơi bóng rổ phong trào đều phù hợp.",
    images: [img("1556906781-9a412961c28c"), img("1552346154-21d32810aba3")],
    specs: { "Chất liệu": "Da", "Kiểu": "Low top" },
  },
  {
    name: "Nike SB Dunk High",
    category: "Giày",
    price: 3450000,
    stock: 9,
    featured: false,
    description:
      "Cổ cao bảo vệ mắt cá, lưỡi gà dày dành cho skate. Đế cao su có rãnh tăng độ bám trên ván.",
    images: [img("1584735175315-9d5df23860e6")],
    specs: { "Chất liệu": "Da lộn", "Kiểu": "High top" },
  },
  {
    name: "Nike Revolution 7",
    category: "Giày",
    price: 1690000,
    stock: 30,
    featured: false,
    description:
      "Giày chạy phổ thông giá tốt, upper mesh nhẹ và thoáng, đệm foam mềm cho người mới bắt đầu chạy bộ.",
    images: [img("1460353581641-37baddab0fa2")],
    specs: { "Trọng lượng": "240 g", "Bảo hành": "6 tháng" },
  },
  {
    name: "Nike SuperRep Go 3",
    category: "Giày",
    price: 2590000,
    stock: 14,
    featured: false,
    description:
      "Giày tập luyện trong phòng gym: đế bám sàn, phần giữa bàn chân ổn định khi squat và nhảy.",
    images: [img("1606107557195-0e29a4b5b4aa")],
    specs: { "Chất liệu": "Mesh", "Dùng cho": "HIIT, gym" },
  },
  {
    name: "Air Jordan 1 Low",
    category: "Giày",
    price: 3990000,
    stock: 8,
    featured: true,
    description:
      "Bản low của biểu tượng Jordan 1, da thật phối màu đỏ đen, đế Air Sole êm ái.",
    images: [img("1552346154-21d32810aba3")],
    specs: { "Chất liệu": "Da thật", "Kiểu": "Low top" },
  },
  {
    name: "Nike Air Force 1 Wheat",
    category: "Giày",
    price: 3090000,
    stock: 11,
    featured: false,
    description:
      "Phối màu wheat nổi bật, da nubuck dày dặn, phù hợp mùa lạnh và phong cách đường phố.",
    images: [img("1549298916-b41d501d3772")],
    specs: { "Chất liệu": "Nubuck", "Kiểu": "Low top" },
  },
  {
    name: "Adidas Ultraboost Light",
    category: "Giày",
    price: 4290000,
    stock: 15,
    featured: true,
    description:
      "Đệm BOOST Light nhẹ hơn 30%, upper Primeknit ôm chân như tất, hoàn trả năng lượng tốt khi chạy.",
    images: [img("1560769629-975ec94e6a86")],
    specs: { "Đệm": "BOOST Light", "Upper": "Primeknit" },
  },
  {
    name: "Adidas Runfalcon 3.0",
    category: "Giày",
    price: 1490000,
    stock: 28,
    featured: false,
    description:
      "Giày chạy vào gym hằng ngày, đệm Cloudfoam êm, giá dễ tiếp cận, thiết kế trẻ trung.",
    images: [img("1595341888016-a392ef81b7de")],
    specs: { "Đệm": "Cloudfoam", "Bảo hành": "6 tháng" },
  },
  {
    name: "Puma Velocity Nitro 3",
    category: "Giày",
    price: 2790000,
    stock: 13,
    featured: false,
    description:
      "Bọt NITRO nhẹ và đàn hồi, đế PUMAGRIP bám tốt cả khi mặt đường ẩm. Dành cho chạy tempo.",
    images: [img("1608231387042-66d1773070a5")],
    specs: { "Đệm": "NITRO foam", "Đế": "PUMAGRIP" },
  },
  {
    name: "New Balance 574 Sport",
    category: "Giày",
    price: 2390000,
    stock: 17,
    featured: false,
    description:
      "Kiểu dáng cổ điển của 574 với đế ENCAP êm hơn, chất liệu suede - mesh bền bỉ.",
    images: [img("1539185441755-769473a23570")],
    specs: { "Chất liệu": "Suede + mesh", "Đế": "ENCAP" },
  },

  // ------------------------------- ÁO -------------------------------
  {
    name: "Áo thể thao nam Dri-FIT trắng",
    category: "Áo",
    price: 390000,
    stock: 60,
    featured: true,
    description:
      "Áo tập nam công nghệ hút ẩm Dri-FIT, cổ tròn, form regular. Thoáng khí, nhanh khô sau khi giặt.",
    images: [img("1521572163474-6864f9cf17ab"), img("1620799139507-2a76f79a2f4d")],
    specs: { "Chất liệu": "100% polyester", "Form": "Regular" },
  },
  {
    name: "Áo bóng đá thi đấu Home Kit",
    category: "Áo",
    price: 550000,
    stock: 45,
    featured: true,
    description:
      "Áo bóng đá vải mè co giãn 4 chiều, đường may lock giữ form khi tranh chấp. Có sẵn size S-XXL.",
    images: [img("1526232761682-d26e03ac148e")],
    specs: { "Chất liệu": "Vải mè polyester", "Kiểu": "Áo thi đấu" },
  },
  {
    name: "Áo gym nam cotton đen",
    category: "Áo",
    price: 320000,
    stock: 70,
    featured: false,
    description:
      "Áo cotton pha spandex mềm, co giãn tốt khi tập tạ, không bị bó vai khi đẩy ngực.",
    images: [img("1503341504253-dff4815485f1")],
    specs: { "Chất liệu": "Cotton + spandex", "Form": "Slim" },
  },
  {
    name: "Áo chạy bộ nam Olive",
    category: "Áo",
    price: 420000,
    stock: 38,
    featured: false,
    description:
      "Áo chạy bộ màu olive, vải siêu nhẹ có lỗ thoáng ở lưng, phản quang nhỏ ở tay áo cho buổi chạy tối.",
    images: [img("1519058082700-08a0b56da9b4")],
    specs: { "Chất liệu": "Polyester recycled", "Phản quang": "Có" },
  },
  {
    name: "Áo thun thể thao in họa tiết",
    category: "Áo",
    price: 350000,
    stock: 52,
    featured: false,
    description:
      "Áo thun in họa tiết thể thao, chất cotton 2 chiều mềm mát, mặc tập hoặc đi chơi đều được.",
    images: [img("1576566588028-4147f3842f27")],
    specs: { "Chất liệu": "Cotton 2 chiều", "In": "Lụa cao cấp" },
  },
  {
    name: "Combo 3 áo tập luyện basic",
    category: "Áo",
    price: 890000,
    stock: 25,
    featured: true,
    description:
      "Combo 3 áo basic nhiều màu cho cả tuần tập. Vải mềm, giữ form tốt sau nhiều lần giặt.",
    images: [img("1562157873-818bc0726f68")],
    specs: { "Số lượng": "3 áo", "Chất liệu": "Cotton pha" },
  },
  {
    name: "Áo hoodie thể thao xám",
    category: "Áo",
    price: 750000,
    stock: 22,
    featured: false,
    description:
      "Hoodie nỉ bông giữ ấm khi khởi động ngoài trời, có túi kangaroo và mũ 2 lớp.",
    images: [img("1556821840-3a63f95609a7")],
    specs: { "Chất liệu": "Nỉ bông", "Mùa": "Thu đông" },
  },
  {
    name: "Áo sweatshirt trắng unisex",
    category: "Áo",
    price: 690000,
    stock: 26,
    featured: false,
    description:
      "Sweatshirt cổ tròn màu trắng, form unisex rộng nhẹ, phối cùng jogger cực dễ.",
    images: [img("1620799140408-edc6dcb6d633")],
    specs: { "Chất liệu": "Cotton nỉ", "Form": "Unisex" },
  },
  {
    name: "Áo tập luyện nam form rộng",
    category: "Áo",
    price: 290000,
    stock: 48,
    featured: false,
    description:
      "Áo form rộng thoải mái khi tập vai và tay, vải mát, thấm hút nhanh.",
    images: [img("1571945153237-4929e783af4a")],
    specs: { "Chất liệu": "Polyester", "Dùng cho": "Gym" },
  },
  {
    name: "Áo khoác thể thao track jacket",
    category: "Áo",
    price: 980000,
    stock: 19,
    featured: false,
    description:
      "Áo khoác gió mỏng chống nước nhẹ, khoá kéo full-zip, có hai túi hai bên và bo tay co giãn.",
    images: [img("1596870230751-ebdfce98ec42")],
    specs: { "Chống nước": "Nhẹ", "Khoá": "Full-zip" },
  },

  // ------------------------------ QUẦN ------------------------------
  {
    name: "Quần jogger thể thao",
    category: "Quần",
    price: 590000,
    stock: 40,
    featured: true,
    description:
      "Quần jogger bo gấu, vải mềm co giãn, hai túi có khoá. Mặc tập gym hoặc đi lại hằng ngày.",
    images: [img("1594633312681-425c7b97ccd1"), img("1552902865-b72c031ac5ea")],
    specs: { "Chất liệu": "Cotton + spandex", "Túi": "2 túi khoá" },
  },
  {
    name: "Quần short chạy bộ 5 inch",
    category: "Quần",
    price: 420000,
    stock: 44,
    featured: true,
    description:
      "Short chạy bộ 5 inch có lớp lót trong, dây rút và túi nhỏ đựng chìa khoá. Siêu nhẹ, không cản bước.",
    images: [img("1483721310020-03333e577078")],
    specs: { "Độ dài": "5 inch", "Lót trong": "Có" },
  },
  {
    name: "Quần short thể thao nam",
    category: "Quần",
    price: 380000,
    stock: 50,
    featured: false,
    description:
      "Short tập gym vải poly co giãn, gấu chéo giúp thoải mái khi squat và lunge.",
    images: [img("1517343985841-f8b2d66e010b")],
    specs: { "Chất liệu": "Polyester", "Dùng cho": "Gym" },
  },
  {
    name: "Quần legging tập gym nữ",
    category: "Quần",
    price: 560000,
    stock: 36,
    featured: true,
    description:
      "Legging cạp cao nâng hông, vải dày không xuyên thấu, co giãn 4 chiều theo mọi động tác.",
    images: [img("1571019613576-2b22c76fd955")],
    specs: { "Cạp": "Cao", "Co giãn": "4 chiều" },
  },
  {
    name: "Quần dài training nữ",
    category: "Quần",
    price: 640000,
    stock: 24,
    featured: false,
    description:
      "Quần dài training ống suông nhẹ, thoáng khí, phù hợp lớp yoga, zumba và chạy trong nhà.",
    images: [img("1606902965551-dce093cda6e7")],
    specs: { "Ống": "Suông", "Chất liệu": "Polyester" },
  },
  {
    name: "Quần bóng đá thi đấu",
    category: "Quần",
    price: 310000,
    stock: 55,
    featured: false,
    description:
      "Quần bóng đá vải mè nhẹ, thấm hút tốt, có dây rút trong và lớp lót mắt lưới.",
    images: [img("1553778263-73a83bab9b0c")],
    specs: { "Chất liệu": "Vải mè", "Kiểu": "Thi đấu" },
  },

  // ---------------------------- PHỤ KIỆN ----------------------------
  {
    name: "Balo thể thao 25L",
    category: "Phụ kiện",
    price: 690000,
    stock: 30,
    featured: true,
    description:
      "Balo 25L có ngăn đựng giày riêng, ngăn laptop 15 inch chống sốc, quai đeo đệm dày.",
    images: [img("1553062407-98eeb64c6a62")],
    specs: { "Dung tích": "25L", "Ngăn laptop": "15 inch" },
  },
  {
    name: "Balo du lịch thể thao 35L",
    category: "Phụ kiện",
    price: 990000,
    stock: 18,
    featured: false,
    description:
      "Balo 35L vải chống nước nhẹ, khoá kéo YKK, phù hợp đi tập kèm chuyến đi ngắn ngày.",
    images: [img("1547949003-9792a18a2601")],
    specs: { "Dung tích": "35L", "Chống nước": "Có" },
  },
  {
    name: "Bình nước thể thao 750ml",
    category: "Phụ kiện",
    price: 150000,
    stock: 90,
    featured: false,
    description:
      "Bình nhựa Tritan không BPA, nắp bật một tay, vạch chia ml giúp theo dõi lượng nước uống.",
    images: [img("1523362628745-0c100150b504")],
    specs: { "Dung tích": "750 ml", "Chất liệu": "Tritan" },
  },
  {
    name: "Bình giữ nhiệt inox 500ml",
    category: "Phụ kiện",
    price: 320000,
    stock: 42,
    featured: true,
    description:
      "Bình inox 2 lớp giữ nóng 8 giờ, giữ lạnh 12 giờ, sơn nhám chống trượt.",
    images: [img("1602143407151-7111542de6e8")],
    specs: { "Dung tích": "500 ml", "Giữ nhiệt": "8-12 giờ" },
  },
  {
    name: "Găng tay tập gym",
    category: "Phụ kiện",
    price: 250000,
    stock: 60,
    featured: false,
    description:
      "Găng tay hở ngón có đệm lòng bàn tay, chống chai tay và tăng độ bám khi deadlift.",
    images: [img("1583454110551-21f2fa2afe61")],
    specs: { "Kiểu": "Hở ngón", "Size": "S/M/L" },
  },
  {
    name: "Băng cổ tay tập tạ",
    category: "Phụ kiện",
    price: 180000,
    stock: 65,
    featured: false,
    description:
      "Băng cổ tay co giãn có chốt dán, ổn định khớp khi đẩy nặng, dùng được cho cả nam và nữ.",
    images: [img("1517838277536-f5f99be501cd")],
    specs: { "Chiều dài": "45 cm", "Số lượng": "2 chiếc" },
  },
  {
    name: "Đồng hồ thể thao GPS",
    category: "Phụ kiện",
    price: 3290000,
    stock: 12,
    featured: true,
    description:
      "Đồng hồ chạy bộ có GPS, đo nhịp tim liên tục, pin 10 ngày, chống nước 5ATM.",
    images: [img("1523275335684-37898b6baf30")],
    specs: { "GPS": "Có", "Chống nước": "5ATM", "Pin": "10 ngày" },
  },
  {
    name: "Đồng hồ thông minh thể thao",
    category: "Phụ kiện",
    price: 4590000,
    stock: 10,
    featured: false,
    description:
      "Smartwatch theo dõi vận động, SpO2, giấc ngủ; hiển thị thông báo và điều khiển nhạc khi chạy.",
    images: [img("1579586337278-3befd40fd17a")],
    specs: { "Màn hình": "AMOLED", "Cảm biến": "Nhịp tim, SpO2" },
  },
  {
    name: "Đồng hồ thể thao chống nước",
    category: "Phụ kiện",
    price: 1890000,
    stock: 20,
    featured: false,
    description:
      "Đồng hồ thể thao dây silicone, chống nước tốt, phù hợp bơi và tập ngoài trời.",
    images: [img("1622434641406-a158123450f9")],
    specs: { "Dây": "Silicone", "Chống nước": "5ATM" },
  },
  {
    name: "Thảm yoga TPE 6mm kèm block",
    category: "Phụ kiện",
    price: 520000,
    stock: 34,
    featured: false,
    description:
      "Thảm TPE 6mm hai lớp chống trượt, kèm block hỗ trợ động tác. Cuộn gọn, có dây buộc.",
    images: [img("1591291621164-2c6367723315")],
    specs: { "Độ dày": "6 mm", "Chất liệu": "TPE" },
  },
  {
    name: "Mũ len thể thao",
    category: "Phụ kiện",
    price: 190000,
    stock: 48,
    featured: false,
    description:
      "Mũ len dệt kim giữ ấm khi chạy mùa lạnh, bo mềm không hằn trán.",
    images: [img("1618354691792-d1d42acfd860")],
    specs: { "Chất liệu": "Acrylic", "Size": "Free" },
  },
  {
    name: "Bóng đá size 5",
    category: "Phụ kiện",
    price: 450000,
    stock: 40,
    featured: true,
    description:
      "Bóng đá size 5 khâu máy, ruột butyl giữ hơi lâu, phù hợp sân cỏ tự nhiên và nhân tạo.",
    images: [img("1614632537190-23e4146777db")],
    specs: { "Size": "5", "Ruột": "Butyl" },
  },
  {
    name: "Bóng đá cỏ nhân tạo Pro",
    category: "Phụ kiện",
    price: 620000,
    stock: 26,
    featured: false,
    description:
      "Bóng dán nhiệt bề mặt hạt nhám tăng ma sát, đường bay ổn định khi sút xa.",
    images: [img("1579952363873-27f3bade9f55")],
    specs: { "Công nghệ": "Dán nhiệt", "Size": "5" },
  },
  {
    name: "Bóng rổ outdoor size 7",
    category: "Phụ kiện",
    price: 520000,
    stock: 24,
    featured: false,
    description:
      "Bóng rổ cao su outdoor size 7, gân sâu dễ cầm, bền khi chơi trên sân bê tông.",
    images: [img("1521412644187-c49fa049e84d")],
    specs: { "Size": "7", "Chất liệu": "Cao su" },
  },
  {
    name: "Hộp 3 bóng tennis",
    category: "Phụ kiện",
    price: 180000,
    stock: 50,
    featured: false,
    description:
      "Hộp 3 quả bóng tennis nỉ áp suất chuẩn thi đấu, nảy đều trên sân cứng.",
    images: [img("1587280501635-68a0e82cd5ff"), img("1595435742656-5272d0b3fa82")],
    specs: { "Số lượng": "3 quả", "Dùng cho": "Sân cứng" },
  },
];
