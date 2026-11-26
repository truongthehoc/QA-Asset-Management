# IT Asset Management — Windows Agent

Thư mục này cung cấp **2 phiên bản Windows Agent** dùng chung giao thức API (`/api/v1/agent/*`):

## 1. PowerShell Native Agent (`agent/windows-agent/`) — Khuyên dùng triển khai nhanh
- **Không cần cài đặt .NET SDK hay Node.js** trên máy trạm (chạy sẵn trên mọi Windows 10/11/Server).
- **Cách triển khai nhanh nhất (1-Click từ Web Admin):**
  1. Đăng nhập Web App → **Danh mục & quản trị → Quản lý phiên bản Agent**.
  2. Tạo **Enrollment Token** (hoặc dùng token hiện có) và điền **URL Máy chủ Backend** (ví dụ `https://itam.congty.vn`).
  3. Nhấn **Tải file cài đặt (.bat)** → tải về 1 file duy nhất `ITAssetAgent-Setup.bat`.
  4. Chạy `ITAssetAgent-Setup.bat` trên máy Windows cần quản lý (tự xin quyền Administrator):
     - Cài dịch vụ nền `ITAssetManagementAgent` (Scheduled Task chạy dưới quyền `SYSTEM` khi khởi động Windows).
     - Cài biểu tượng khay hệ thống `ITAssetManagementAgentTray` (xem trạng thái đồng bộ, mở `config.json`, xem log, bấm **Đồng bộ ngay**).
     - Tự động Enroll và gửi Snapshot phần cứng / OS / Windows License / Phần mềm lần đầu ngay lập tức.
- **Thư mục cài đặt & cấu hình trên máy trạm:**
  - Chương trình: `C:\Program Files\ITAssetAgent\` (`ITAssetAgent.ps1`, `ITAssetAgentTray.ps1`, `uninstall.bat`)
  - Cấu hình: `C:\ProgramData\ITAssetAgent\config.json`
  - Nhật ký: `C:\ProgramData\ITAssetAgent\logs\agent.log`

## 2. C# / .NET 8 Windows Service (`agent/ITAssetAgent/`) — Dành cho đóng gói `.exe` / `.msi` triển khai GPO
- Yêu cầu máy build có **.NET 8 SDK** (và **WiX Toolset** nếu đóng gói `.msi`).
- Chạy script build phát hành:
  ```powershell
  cd agent\ITAssetAgent\deploy
  .\build-release.ps1 -Version "1.2.0"
  ```
- Kết quả tạo ra `agent\ITAssetAgent\release\win-x64\ITAssetAgent.exe` (self-contained single-file) và file `.msi` (nếu có WiX) để triển khai hàng loạt qua Active Directory GPO.
