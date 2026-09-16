# 🚀 FUN Profile - Parallel Development Kit (PDK)

> Bộ công cụ cho phép 15+ cộng sự phát triển tính năng song song, độc lập và tương thích 100% với Fun Profile.

---

## 📖 Mục Lục

1. [Bắt Đầu Trong 5 Phút](#-bắt-đầu-trong-5-phút)
2. [Cấu Trúc PDK](#-cấu-trúc-pdk)
3. [Tạo Feature Mới](#-tạo-feature-mới)
4. [Documentation](#-documentation)
5. [Hỗ Trợ](#-hỗ-trợ)

---

## ⚡ Bắt Đầu Trong 5 Phút

### Bước 1: Tạo Project Lovable Mới

1. Truy cập [lovable.dev](https://lovable.dev)
2. Tạo project mới với tên: `fun-{ten-feature}` (ví dụ: `fun-referral`, `fun-badges`)
3. Chờ project khởi tạo xong

### Bước 2: Copy PDK vào Project

1. Copy **toàn bộ folder `pdk/`** vào project mới
2. Đảm bảo cấu trúc như sau:

```
your-project/
├── pdk/                    ← Copy vào đây
│   ├── README.md
│   ├── CONVENTIONS.md
│   ├── API_CONTRACT.md
│   ├── MERGE_GUIDE.md
│   ├── core/
│   ├── config/
│   ├── templates/
│   └── examples/
│
└── features/               ← Code của bạn sẽ ở đây
    └── {ten-feature}/
```

### Bước 3: Cài Đặt Dependencies

Yêu cầu Angel Lovable cài đặt các packages sau:

```
@radix-ui/react-dialog
@radix-ui/react-tabs
@radix-ui/react-select
@radix-ui/react-checkbox
@radix-ui/react-switch
@radix-ui/react-progress
@radix-ui/react-scroll-area
@radix-ui/react-toast
@radix-ui/react-label
@radix-ui/react-separator
@radix-ui/react-avatar
class-variance-authority
clsx
tailwind-merge
lucide-react
sonner
next-themes
```

### Bước 4: Setup Config Files

Copy các file config từ `pdk/config/` vào đúng vị trí:

| File nguồn | Vị trí đích |
|------------|-------------|
| `pdk/config/tailwind.config.ts` | `tailwind.config.ts` (root) |
| `pdk/config/index.css` | `src/index.css` |
| `pdk/config/components.json` | `components.json` (root) |

### Bước 5: Bắt Đầu Code!

1. Tạo folder `features/{ten-feature}/`
2. Copy template từ `pdk/templates/feature/`
3. Bắt đầu phát triển!

---

## 📁 Cấu Trúc PDK

```
pdk/
├── README.md                 # File này
├── CONVENTIONS.md            # Quy ước đặt tên, coding style
├── API_CONTRACT.md           # Database schema, API có sẵn
├── MERGE_GUIDE.md            # Hướng dẫn submit code
│
├── core/                     # Core code (KHÔNG SỬA)
│   ├── components/ui/        # 20 UI components
│   ├── hooks/                # 4 hooks dùng chung
│   └── lib/                  # Utilities
│
├── config/                   # Config files
│   ├── tailwind.config.ts    # Tailwind configuration
│   ├── index.css             # CSS variables + theme
│   └── components.json       # shadcn configuration
│
├── templates/                # Templates cho feature mới
│   └── feature/              # Template chuẩn
│
└── examples/                 # Ví dụ hoàn chỉnh
    └── badges-feature/       # Ví dụ: Hệ thống huy hiệu
```

---

## 🎨 Tạo Feature Mới

### Cấu Trúc Feature

Mỗi feature phải nằm trong folder riêng:

```
features/{ten-feature}/
├── README.md                 # Mô tả feature
├── components/               # React components
│   ├── FeatureCard.tsx
│   └── FeatureList.tsx
├── hooks/                    # Custom hooks
│   └── useFeature.ts
├── pages/                    # Full pages (nếu cần)
│   └── FeaturePage.tsx
└── database/                 # Database migrations (nếu cần)
    └── migration.sql
```

### Sử Dụng Components

```tsx
// ✅ ĐÚNG - Import từ pdk/core
import { Button } from "@/pdk/core/components/ui/button";
import { Card } from "@/pdk/core/components/ui/card";
import { useToast } from "@/pdk/core/hooks/use-toast";

// ❌ SAI - Đừng import từ nơi khác
import { Button } from "@/components/ui/button";
```

### Ví Dụ Component

```tsx
// features/referral/components/ReferralCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/pdk/core/components/ui/card";
import { Button } from "@/pdk/core/components/ui/button";

interface ReferralCardProps {
  code: string;
  referrals: number;
}

export function ReferralCard({ code, referrals }: ReferralCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mã Giới Thiệu</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{code}</p>
        <p className="text-muted-foreground">
          {referrals} người đã sử dụng
        </p>
        <Button className="mt-4">Sao chép mã</Button>
      </CardContent>
    </Card>
  );
}
```

---

## 📚 Documentation

| File | Nội dung |
|------|----------|
| [CONVENTIONS.md](./CONVENTIONS.md) | Quy ước đặt tên files, components, database |
| [API_CONTRACT.md](./API_CONTRACT.md) | Database schema, API endpoints có sẵn |
| [MERGE_GUIDE.md](./MERGE_GUIDE.md) | Hướng dẫn submit code và quy trình review |

---

## ⚠️ Quy Tắc Quan Trọng

### ✅ ĐƯỢC PHÉP

- Tạo components mới trong `features/{feature}/components/`
- Tạo hooks mới trong `features/{feature}/hooks/`
- Tạo pages mới trong `features/{feature}/pages/`
- Tạo database tables mới với prefix feature (ví dụ: `referral_codes`)
- Import từ `@/pdk/core/`

### ❌ KHÔNG ĐƯỢC PHÉP

- Sửa đổi bất kỳ file nào trong `pdk/core/`
- Sửa đổi bất kỳ file nào trong `pdk/config/`
- Sử dụng CSS custom (chỉ dùng Tailwind)
- Tạo tables database không có prefix feature
- Import trực tiếp từ thư viện bên ngoài mà không qua PDK

---

## 🤝 Hỗ Trợ

Nếu cần hỗ trợ:

1. **Đọc documentation** - Hầu hết câu hỏi đã có trong docs
2. **Xem examples** - Folder `pdk/examples/` có ví dụ hoàn chỉnh
3. **Hỏi Angel** - Nhờ Angel Lovable trong project của bạn hỗ trợ
4. **Liên hệ Angel Fun Profile** - Khi cần merge hoặc có vấn đề phức tạp

---

## 🎯 Checklist Trước Khi Submit

```
[ ] Code trong folder features/{feature-name}/
[ ] Sử dụng components từ @/pdk/core/
[ ] Tuân thủ naming conventions (xem CONVENTIONS.md)
[ ] Responsive trên mobile
[ ] Có error handling với toast
[ ] Không có console.log thừa
[ ] Có README.md mô tả feature
[ ] Database migration có RLS policies (nếu có)
```

---

**Chúc bạn phát triển vui vẻ! 🎉**
