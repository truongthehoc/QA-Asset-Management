# IT Asset Management — Hệ thống Quản lý Tài sản CNTT Nội bộ

Hệ thống quản lý tập trung toàn bộ tài sản CNTT trong mạng nội bộ (LAN), xây dựng đầy đủ theo tài liệu đặc tả `IT_Asset_Management_SRS_v1.0 (1).md`.

## Kiến trúc hệ thống

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| **Web Application** | React 18 + Vite + TypeScript + Tailwind CSS + Recharts | `frontend/` |
| **Backend API** | NestJS + TypeScript + Prisma ORM + Swagger OpenAPI | `backend/` |
| **Database** | SQLite (chạy nhanh cục bộ) / MySQL 8.0 (`prisma/schema.mysql.prisma` + `docker-compose.yml`) | `backend/prisma/` |
| **File Storage** | Lưu trữ tệp nội bộ theo UUID, kiểm tra MIME/Extension & phân quyền tải | `backend/storage/uploads/` |
| **Windows Agent** | C# / .NET 8 Worker Service (WMI/CIM, Registry, Event Log, DPAPI, WiX MSI) | `agent/ITAssetAgent/` |
| **Agent Simulator** | Node.js live agent để kiểm thử nhanh luồng Enroll / Snapshot / Heartbeat | `agent/simulator/` |

## Khởi chạy nhanh cục bộ (Local Dev)

### Cách 1: Nhấn đúp file khởi động (khuyên dùng trên Windows)
- Chạy **`start.bat`** để tự động kiểm tra thư viện, khởi tạo database (nếu chưa có), chạy Backend (`3001`), Frontend (`5175`) và tự mở trình duyệt.
- Chạy **`stop.bat`** để tắt sạch cả Backend và Frontend.

### Cách 2: Chạy thủ công bằng dòng lệnh
#### 1. Khởi tạo cơ sở dữ liệu & dữ liệu mẫu
```bash
npm run db:setup
```

### 2. Chạy Backend API (http://localhost:3001)
```bash
npm run dev:backend
```
- Swagger API Docs: `http://localhost:3001/api/docs`

### 3. Chạy Frontend Web App (http://localhost:5173)
```bash
npm run dev:frontend
```

### 4. Tài khoản đăng nhập mẫu (Mật khẩu chung: `Admin@123`)
- **`sysadmin`** — System Admin (toàn quyền quản trị, cấu hình, phân quyền, Audit Log)
- **`itadmin`** — IT Admin (duyệt thiết bị, điều chuyển, kiểm kê, xác minh thay đổi Baseline)
- **`itstaff`** — IT Staff (nghiệp vụ theo phạm vi cơ sở)
- **`qaviewer`** — Department Viewer (chỉ xem tài sản thuộc Phòng QA)

### 5. Kiểm thử trực tiếp Windows Agent (Live Simulator)
```bash
npm run agent:simulate
```
Lệnh trên sẽ dùng Enrollment Token mẫu (`ENROLL-ITAM-2026-INTERNAL`) để đăng ký máy trạm mới, gửi toàn bộ cấu hình phần cứng/OS/phần mềm và Heartbeat về Backend. Sau đó mở mục **Khám phá thiết bị → Thiết bị chờ duyệt** để phê duyệt thành tài sản chính thức.

## Triển khai Production với MySQL 8.0
Sử dụng `docker-compose.yml` (hoặc đổi `backend/prisma/schema.prisma` sang `backend/prisma/schema.mysql.prisma` và cấu hình `DATABASE_URL="mysql://..."`).
