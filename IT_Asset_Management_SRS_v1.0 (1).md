# ĐẶC TẢ PHÂN TÍCH HỆ THỐNG

# IT ASSET MANAGEMENT -- QUẢN LÝ TÀI SẢN CNTT NỘI BỘ

  -----------------------------------------------------------------------
  Thuộc tính                          Nội dung
  ----------------------------------- -----------------------------------
  Tên dự án                           IT Asset Management

  Tên tiếng Việt                      Hệ thống quản lý tài sản công nghệ
                                      thông tin nội bộ

  Phiên bản tài liệu                  1.0

  Trạng thái                          Tài liệu phân tích và định hướng
                                      triển khai

  Phạm vi triển khai                  Mạng nội bộ (LAN)

  Đối tượng sử dụng                   Bộ phận IT, quản trị hệ thống và
                                      các phòng ban được phân quyền

  Frontend                            React + Vite + TypeScript

  Backend                             NestJS + TypeScript

  ORM                                 Prisma

  Database                            MySQL

  Windows Agent                       C# / .NET Worker Service

  Lưu trữ hồ sơ                       File Storage trên máy chủ nội bộ
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 1. Tổng quan dự án

### 1.1. Mục đích

Xây dựng hệ thống quản lý tập trung toàn bộ tài sản công nghệ thông tin
trong đơn vị. Hệ thống kết hợp quản lý tài sản theo nghiệp vụ với cơ chế
tự động thu thập thông tin thiết bị thông qua Windows Agent được cài đặt
một lần trên mỗi máy tính.

Hệ thống phải hỗ trợ xuyên suốt vòng đời tài sản:

1.  Phát hiện thiết bị trong mạng nội bộ.
2.  Đăng ký và thu thập thông tin thông qua Agent.
3.  Đưa thiết bị vào danh sách chờ kiểm duyệt.
4.  IT kiểm tra và duyệt ghi nhận thành tài sản chính thức.
5.  Bổ sung thông tin mua sắm, phòng ban, người sử dụng, bảo hành và hồ
    sơ.
6.  Theo dõi cấu hình thực tế và phát hiện thay đổi.
7.  Quản lý bàn giao, điều chuyển, bảo trì, kiểm kê và thanh lý.
8.  Tổng hợp báo cáo và cảnh báo phục vụ quản trị.

### 1.2. Mục tiêu

-   Tự động hóa công tác kiểm kê cấu hình máy tính.
-   Hạn chế việc nhập liệu thủ công và sai lệch thông tin.
-   Quản lý tập trung thông tin tài sản, hồ sơ mua sắm và lịch sử sử
    dụng.
-   Phát hiện thiết bị mới xuất hiện trong mạng nội bộ nhưng chưa được
    ghi nhận.
-   Phát hiện và cảnh báo khi cấu hình phần cứng, hệ điều hành hoặc phần
    mềm thay đổi.
-   Theo dõi bảo hành, sửa chữa, nâng cấp và chi phí vòng đời tài sản.
-   Cung cấp dữ liệu chính xác cho công tác kiểm kê và lập kế hoạch mua
    sắm.

### 1.3. Nguyên tắc thiết kế

**Nguyên tắc 1 -- Agent là nguồn thu thập cấu hình chuyên sâu**

Windows Agent là thành phần chính chịu trách nhiệm thu thập dữ liệu phần
cứng, hệ điều hành, trạng thái kích hoạt Windows và phần mềm đã cài đặt.
LAN Discovery chỉ hỗ trợ phát hiện thiết bị và đối chiếu mạng, không
được xem là nguồn thu thập cấu hình đầy đủ.

**Nguyên tắc 2 -- Tách thiết bị phát hiện và tài sản chính thức**

Một thiết bị được phát hiện hoặc đăng ký Agent không mặc nhiên trở thành
tài sản chính thức. Thiết bị phải qua bước kiểm tra và phê duyệt của
nhân sự IT có thẩm quyền.

**Nguyên tắc 3 -- Tách cấu hình thực tế và cấu hình được xác nhận**

Dữ liệu Agent thu thập là dữ liệu thực tế tại thời điểm kiểm tra. Cấu
hình được IT xác nhận là dữ liệu chuẩn phục vụ quản lý tài sản. Hai loại
dữ liệu phải được lưu độc lập.

**Nguyên tắc 4 -- Lưu lịch sử, không ghi đè mất dấu vết**

Mọi thay đổi cấu hình, điều chuyển, bàn giao, sửa chữa và cập nhật thông
tin quan trọng phải được lưu lịch sử.

**Nguyên tắc 5 -- An toàn trong môi trường nội bộ**

Agent chỉ thu thập dữ liệu phục vụ quản lý tài sản. Giao tiếp phải được
xác thực, giới hạn quyền và không cung cấp cơ chế thực thi lệnh tùy ý
trên máy trạm.

------------------------------------------------------------------------

## 2. Phạm vi hệ thống

### 2.1. Phạm vi triển khai giai đoạn đầu

Ưu tiên quản lý:

-   Máy tính để bàn (Desktop).
-   Máy tính xách tay (Laptop).
-   Máy chủ Windows (Windows Server).

Các loại tài sản có thể quản lý thủ công hoặc mở rộng ở giai đoạn sau:

-   Màn hình.
-   Máy in, máy scan.
-   Switch, Router, Firewall, Access Point.
-   UPS.
-   Camera, đầu ghi.
-   Thiết bị hội nghị và thiết bị CNTT khác.

### 2.2. Ngoài phạm vi MVP

Các nội dung sau không thuộc phạm vi bắt buộc của phiên bản đầu:

-   Điều khiển máy tính từ xa.
-   Truy cập hoặc điều khiển màn hình người dùng.
-   Quản lý nội dung cá nhân của người dùng.
-   Triển khai phần mềm từ xa.
-   Gỡ phần mềm từ xa.
-   Quản lý bản quyền phần mềm ở mức kiểm toán pháp lý đầy đủ.
-   Tự động thực thi lệnh quản trị trên máy trạm.

Các nội dung này chỉ được xem xét nếu có yêu cầu nghiệp vụ, đánh giá bảo
mật và phê duyệt riêng.

------------------------------------------------------------------------

## 3. Kiến trúc tổng thể

### 3.1. Thành phần kiến trúc

Hệ thống gồm 5 thành phần chính:

1.  **Windows Agent:** Cài trên máy Windows, thu thập và giám sát thông
    tin thiết bị.
2.  **LAN Discovery:** Quét các dải mạng được IT khai báo để phát hiện
    thiết bị và đối chiếu.
3.  **Backend API:** Tiếp nhận dữ liệu, xử lý nghiệp vụ, so sánh cấu
    hình, tạo cảnh báo và cung cấp API.
4.  **Database và File Storage:** Lưu dữ liệu nghiệp vụ, dữ liệu kiểm
    kê, lịch sử và hồ sơ đính kèm.
5.  **Web Application:** Giao diện quản trị, kiểm duyệt, quản lý tài
    sản, kiểm kê và báo cáo.

### 3.2. Luồng dữ liệu tổng quát

``` text
MÁY TÍNH WINDOWS
    |
    | Windows Agent (Windows Service)
    | - Hardware Inventory
    | - Windows Inventory
    | - Software Inventory
    | - Change Monitoring
    | - Heartbeat
    |
    | HTTPS / API nội bộ
    v
IT ASSET MANAGEMENT BACKEND
    |
    |-- Xác thực Agent
    |-- Tiếp nhận dữ liệu
    |-- Kiểm tra định danh
    |-- Lưu Snapshot
    |-- So sánh Baseline
    |-- Phát hiện thay đổi
    |-- Sinh cảnh báo
    |
    +----------> MYSQL DATABASE
    |
    +----------> FILE STORAGE
    |
    v
WEB APPLICATION
    |
    |-- Dashboard
    |-- Thiết bị chờ duyệt
    |-- Quản lý tài sản
    |-- Lịch sử cấu hình
    |-- Cảnh báo
    |-- Kiểm kê
    |-- Báo cáo
```

### 3.3. Vai trò của LAN Discovery

LAN Discovery là chức năng bổ trợ, không thay thế Windows Agent.

Thông tin có thể phát hiện tùy điều kiện mạng:

-   IP Address.
-   MAC Address.
-   Hostname nếu phân giải được.
-   Trạng thái phản hồi mạng.
-   Thông tin nhà sản xuất từ MAC OUI nếu nhận diện được.
-   Một số thông tin dịch vụ mạng được phép kiểm tra.

LAN Discovery không đảm bảo thu thập được CPU, RAM, ổ cứng, danh sách
ứng dụng hoặc trạng thái license Windows. Các dữ liệu chuyên sâu phải
lấy từ Agent hoặc cơ chế truy vấn từ xa đã được IT cho phép.

------------------------------------------------------------------------

## 4. Windows Agent

### 4.1. Công nghệ

Đề xuất xây dựng Agent bằng C# trên nền .NET Worker Service, đóng gói
thành bộ cài đặt Windows Installer (MSI) và chạy dưới dạng Windows
Service.

Lý do:

-   Phù hợp môi trường Windows.
-   Có thể chạy nền và tự khởi động cùng hệ điều hành.
-   Có thể truy cập các API hệ thống và WMI/CIM phù hợp.
-   Có thể triển khai hàng loạt qua Group Policy (GPO), công cụ quản trị
    endpoint hoặc cài đặt thủ công.
-   Có thể quản lý phiên bản và cập nhật tập trung.

Phiên bản .NET cụ thể cần được chốt theo phiên bản Windows Server và
Windows Client đang sử dụng trong môi trường triển khai.

### 4.2. Yêu cầu hoạt động

Agent phải:

-   Chạy nền dưới dạng Windows Service.
-   Tự khởi động khi Windows khởi động.
-   Có định danh Agent ID duy nhất.
-   Đăng ký với Backend bằng cơ chế enrollment an toàn.
-   Gửi dữ liệu qua HTTPS.
-   Có cơ chế retry khi mất kết nối.
-   Lưu hàng đợi dữ liệu cục bộ khi Backend không khả dụng.
-   Tự đồng bộ khi kết nối trở lại.
-   Ghi log hoạt động và lỗi.
-   Có cơ chế kiểm tra phiên bản.
-   Hỗ trợ thu hồi hoặc vô hiệu hóa Agent.
-   Hạn chế tiêu thụ CPU, RAM, Disk và băng thông.
-   Không làm gián đoạn hoạt động của máy trạm.

### 4.3. Định danh thiết bị

Không sử dụng IP Address làm định danh duy nhất vì IP có thể thay đổi
theo DHCP hoặc cấu hình mạng.

Thứ tự định danh đề xuất:

1.  Agent ID: định danh do Agent tạo và đăng ký với Backend.
2.  SMBIOS UUID / System UUID.
3.  BIOS Serial Number hoặc System Serial Number.
4.  MAC Address: dữ liệu bổ trợ.

Cần xử lý trường hợp UUID hoặc Serial Number bị trống, không hợp lệ,
trùng lặp hoặc bị nhà sản xuất ghi giá trị mặc định.

Nếu phát hiện nhiều định danh mâu thuẫn, hệ thống đưa thiết bị vào trạng
thái cần IT xác minh; không tự động gộp hồ sơ.

### 4.4. Đăng ký Agent lần đầu

Quy trình:

1.  IT cài Agent bằng gói MSI.
2.  Agent tạo hoặc đọc định danh cục bộ.
3.  Agent gửi yêu cầu đăng ký kèm enrollment token hoặc mã cài đặt hợp
    lệ.
4.  Backend xác thực và cấp Agent credential riêng.
5.  Agent thu thập inventory ban đầu.
6.  Agent gửi dữ liệu về Backend.
7.  Backend tạo hồ sơ trong danh sách thiết bị chờ duyệt.
8.  IT kiểm tra và quyết định ghi nhận tài sản.

Enrollment token cần có thời hạn, phạm vi sử dụng và khả năng thu hồi.
Không nhúng một bí mật dùng chung không đổi vào toàn bộ bộ cài Agent.

### 4.5. Dữ liệu phần cứng

  -----------------------------------------------------------------------
  Nhóm                                Thuộc tính
  ----------------------------------- -----------------------------------
  Nhận diện                           Computer Name, Hostname, System
                                      UUID, Serial Number

  Nhà sản xuất                        Manufacturer, Model

  CPU                                 Tên CPU, hãng, số core, số logical
                                      processor, tốc độ

  RAM                                 Tổng dung lượng, từng module, dung
                                      lượng, loại, tốc độ, serial nếu đọc
                                      được

  Mainboard                           Manufacturer, Product, Serial
                                      Number

  BIOS                                Manufacturer, Version, Release
                                      Date, Serial nếu có

  GPU                                 Tên GPU, bộ nhớ đồ họa nếu đọc được

  Disk                                Model, Serial, loại ổ, dung lượng,
                                      phân vùng và dung lượng trống

  Network                             Adapter, MAC, IP, tốc độ liên kết,
                                      trạng thái

  Monitor                             Manufacturer, Model, Serial, độ
                                      phân giải nếu đọc được

  Khác                                Thiết bị phần cứng liên quan khác
                                      nếu có thể đọc ổn định
  -----------------------------------------------------------------------

Dữ liệu thu thập thực tế phụ thuộc phần cứng, firmware, driver, quyền
chạy Agent và khả năng cung cấp của Windows API.

### 4.6. Dữ liệu hệ điều hành và Windows License

Thu thập:

-   Windows Product Name / Edition.
-   Version.
-   Build Number.
-   Architecture.
-   Install Date nếu có.
-   Last Boot Time.
-   Activation Status.
-   License Description.
-   License Channel nếu đọc được.
-   Partial Product Key nếu được phê duyệt.
-   Thời điểm kiểm tra gần nhất.

Không lưu toàn bộ Windows Product Key. Trạng thái Activated không tự
động chứng minh license hợp pháp hoặc đủ điều kiện kiểm toán. Hồ sơ
chứng từ license phải được quản lý riêng.

### 4.7. Dữ liệu phần mềm

Thu thập từ các nguồn Windows phù hợp, bao gồm Registry Uninstall Key
32-bit và 64-bit.

Các trường dữ liệu:

-   Display Name.
-   Publisher.
-   Display Version.
-   Install Date nếu có.
-   Install Location nếu cần thiết.
-   Architecture nếu xác định được.
-   Uninstall Entry.
-   Thời điểm phát hiện.

Lưu ý:

-   Ứng dụng portable có thể không xuất hiện trong danh sách cài đặt.
-   Một số ứng dụng không cung cấp ngày cài đặt hoặc phiên bản chính
    xác.
-   Không thể kết luận license hợp lệ chỉ từ tên ứng dụng và phiên bản.
-   Không thu thập nội dung tài liệu, dữ liệu cá nhân hoặc thông tin
    không phục vụ mục đích quản lý tài sản.

------------------------------------------------------------------------

## 5. Cơ chế giám sát và phát hiện thay đổi cấu hình

### 5.1. Mục tiêu

Sau khi cài đặt, Agent phải tiếp tục giám sát thiết bị. Khi cấu hình
phần cứng, hệ điều hành hoặc phần mềm thay đổi, hệ thống phải ghi nhận
sự kiện và tạo cảnh báo để IT xác minh.

### 5.2. Ba cơ chế kết hợp

**A. Event Monitoring**

Theo dõi các Windows Event Log hoặc Windows notification phù hợp để phát
hiện nhanh các sự kiện có liên quan.

**B. Periodic Inventory**

Định kỳ truy vấn lại thông tin thực tế bằng WMI/CIM và Windows API.

**C. Baseline Comparison**

So sánh dữ liệu vừa thu thập với Baseline đã được IT xác nhận hoặc
Snapshot trước đó.

Không phụ thuộc duy nhất vào Event Log vì không phải mọi thay đổi phần
cứng đều tạo ra sự kiện đầy đủ và đáng tin cậy.

### 5.3. Danh mục thay đổi cần theo dõi

  Thành phần        Nội dung thay đổi
  ----------------- -----------------------------------------------
  CPU               Model, số core, số logical processor
  RAM               Thêm, tháo, thay module, dung lượng, tốc độ
  Disk              Thêm, tháo, thay ổ, model, serial, dung lượng
  Mainboard         Model, manufacturer, serial
  GPU               Thêm, tháo, thay GPU
  Network Adapter   Thêm, tháo, thay adapter
  Monitor           Thêm hoặc tháo màn hình
  BIOS              Phiên bản hoặc thông tin BIOS
  Windows           Edition, Version, Build, Activation Status
  Software          Cài mới, gỡ bỏ, thay đổi phiên bản

Một số thuộc tính có thể thay đổi bình thường mà không phản ánh việc
thay phần cứng, ví dụ IP, MAC của adapter ảo, tên máy hoặc thông tin kết
nối. Hệ thống phải phân loại riêng, tránh tạo cảnh báo sai.

### 5.4. Baseline và Snapshot

Hai khái niệm phải được tách biệt:

-   **Baseline:** Cấu hình chuẩn đã được IT xác nhận và dùng làm mốc
    quản lý.
-   **Snapshot:** Cấu hình thực tế được Agent thu thập tại một thời
    điểm.

Khi phát hiện khác biệt:

1.  Agent gửi dữ liệu mới.
2.  Backend lưu Snapshot.
3.  Backend so sánh Snapshot với Baseline.
4.  Nếu có khác biệt, tạo Device Change.
5.  Tạo Alert Event theo quy tắc.
6.  IT kiểm tra và xác nhận hoặc từ chối thay đổi.
7.  Nếu được duyệt, cập nhật Baseline và thông tin cấu hình chính thức.

Không tự động cập nhật Baseline chỉ vì Agent báo cấu hình mới.

### 5.5. Ví dụ cảnh báo

  Thuộc tính   Trước thay đổi      Sau thay đổi
  ------------ ------------------- -----------------
  Mã tài sản   IT-PC-2026-0001     IT-PC-2026-0001
  Hostname     TMTDM-IT-001        TMTDM-IT-001
  RAM          8 GB                16 GB
  Thời điểm    01/10/2026          19/11/2026
  Trạng thái   Baseline đã duyệt   Chờ xác minh

Thông tin cảnh báo cần có:

-   Tài sản liên quan.
-   Thiết bị và Agent ID.
-   Thành phần thay đổi.
-   Giá trị trước.
-   Giá trị sau.
-   Thời điểm phát hiện.
-   Nguồn dữ liệu.
-   Mức độ cảnh báo.
-   Trạng thái xử lý.
-   Người xác minh.
-   Ghi chú xử lý.

### 5.6. Mức độ cảnh báo

  -----------------------------------------------------------------------
  Mức độ                              Ví dụ
  ----------------------------------- -----------------------------------
  Thông tin                           Phát hiện cài đặt hoặc cập nhật
                                      phần mềm

  Trung bình                          Thay đổi RAM, thêm ổ cứng, thay đổi
                                      cấu hình thông thường

  Cao                                 Thay CPU, Mainboard hoặc ổ đĩa hệ
                                      thống

  Nghiêm trọng                        Agent bị vô hiệu hóa bất thường,
                                      định danh thiết bị mâu thuẫn hoặc
                                      dấu hiệu can thiệp cần xác minh
  -----------------------------------------------------------------------

Mức độ phải cấu hình được, không cố định cứng trong code.

### 5.7. Chu kỳ thu thập đề xuất

  Tác vụ                     Chu kỳ ban đầu
  -------------------------- ---------------------------------------
  Heartbeat                  5 phút
  Kiểm tra CPU/RAM/Disk      30 phút
  Kiểm tra phần mềm          6 giờ
  Kiểm tra Windows License   24 giờ
  Snapshot đầy đủ            24 giờ
  Event Monitoring           Liên tục, theo khả năng Windows
  Đồng bộ khi có thay đổi    Sau khi phát hiện và xác minh dữ liệu

Các chu kỳ phải cấu hình từ Backend. Cần có giới hạn tải và jitter để
tránh toàn bộ Agent đồng bộ cùng một thời điểm.

------------------------------------------------------------------------

## 6. LAN Discovery

### 6.1. Mục đích

-   Phát hiện thiết bị đang hoạt động trong các dải mạng được quản lý.
-   Tìm thiết bị chưa cài Agent.
-   Đối chiếu thiết bị phát hiện với danh sách Agent đã đăng ký.
-   Hỗ trợ IT kiểm kê các thiết bị lạ hoặc chưa được ghi nhận.

### 6.2. Chức năng

-   Khai báo dải IP.
-   Gắn tên khu vực hoặc VLAN.
-   Quét thủ công.
-   Lập lịch quét.
-   Xem tiến trình và lịch sử quét.
-   Xem thiết bị phát hiện.
-   Đối chiếu với Agent và tài sản hiện có.

### 6.3. Giới hạn

Kết quả quét phụ thuộc VLAN, routing, ACL, firewall, chính sách ICMP và
cấu hình mạng. Không xem thiết bị không phản hồi ICMP là chắc chắn đã
tắt hoặc không tồn tại.

------------------------------------------------------------------------

## 7. Quy trình nghiệp vụ duyệt tài sản

### 7.1. Luồng tổng thể

``` text
Agent đăng ký / LAN Discovery phát hiện
                |
                v
      Danh sách thiết bị phát hiện
                |
                v
        IT kiểm tra thông tin
                |
        +-------+-------+
        |               |
     Không duyệt      Duyệt
        |               |
        v               v
  Bỏ qua / Theo dõi   Bổ sung hồ sơ
                        |
                        v
              Sinh mã tài sản duy nhất
                        |
                        v
               Tạo tài sản chính thức
                        |
                        v
              Liên kết Agent với tài sản
                        |
                        v
             Theo dõi vòng đời tài sản
```

### 7.2. Thông tin khi duyệt

**A. Thông tin quản lý**

-   Mã tài sản.
-   Tên tài sản.
-   Nhóm tài sản.
-   Loại tài sản.
-   Trạng thái.
-   Serial Number.
-   Mã QR / Barcode.

**B. Thông tin sử dụng**

-   Cơ sở.
-   Phòng ban quản lý.
-   Phòng ban sử dụng.
-   Người sử dụng.
-   Vị trí đặt thiết bị.
-   Ngày bàn giao.
-   Người bàn giao.
-   Người tiếp nhận.

**C. Thông tin mua sắm**

-   Ngày mua.
-   Ngày đưa vào sử dụng.
-   Nhà cung cấp.
-   Số hợp đồng.
-   Số hóa đơn.
-   Giá mua.
-   Nguồn kinh phí.
-   Ngày bắt đầu bảo hành.
-   Ngày kết thúc bảo hành.

**D. Hồ sơ và ghi chú**

-   Hồ sơ mua sắm PDF.
-   Hóa đơn.
-   Hợp đồng.
-   Biên bản bàn giao.
-   Chứng từ bảo hành.
-   Hình ảnh thiết bị.
-   Ghi chú nội bộ.

Một tài sản được phép có nhiều file đính kèm và mỗi file có loại hồ sơ,
tên, dung lượng, người tải lên và thời điểm tải lên.

### 7.3. Quy tắc mã tài sản

Hệ thống hỗ trợ **hai phương thức thiết lập mã tài sản**:

**A. Tự động sinh mã**

-   Người dùng chọn chức năng tự động sinh mã khi ghi nhận tài sản.
-   Hệ thống sinh mã theo cấu trúc được cấu hình trong phần quản trị.
-   Cấu trúc mặc định đề xuất: `IT-{LOẠI}-{NĂM}-{SỐ THỨ TỰ}`.
-   Ví dụ: `IT-PC-2026-0001`, `IT-LT-2026-0001`, `IT-MN-2026-0001`.
-   Quy tắc, tiền tố và định dạng mã tự động cần có khả năng cấu hình; không bắt buộc mọi đơn vị phải sử dụng cấu trúc mặc định.

**B. Nhập mã thủ công**

-   Người dùng có quyền phù hợp được phép tự nhập mã tài sản theo quy ước riêng của đơn vị.
-   Mã nhập thủ công được phép sử dụng chữ, số, ký tự phân tách hoặc cấu trúc tùy ý; không bắt buộc tuân theo tiền tố, loại tài sản, năm hoặc số thứ tự do hệ thống đề xuất.
-   Hệ thống không tự ý chuẩn hóa hoặc thay đổi nội dung mã do người dùng nhập, ngoại trừ việc loại bỏ khoảng trắng ở đầu và cuối để kiểm tra dữ liệu.
-   Có thể sử dụng mã tài sản đang tồn tại theo quy ước hoặc hệ thống mã hóa cũ khi chuyển dữ liệu sang hệ thống mới.

**Quy tắc áp dụng chung**

-   Mã tài sản là thông tin bắt buộc và phải duy nhất trong phạm vi toàn hệ thống. Hệ thống phải kiểm tra trùng mã trước khi lưu, áp dụng cho cả mã tự sinh và mã nhập thủ công.
-   Nếu mã thủ công bị trùng, hệ thống thông báo và yêu cầu người dùng nhập mã khác; không tự động sửa mã.
-   Mã tài sản không được tự động thay đổi trong quá trình sử dụng. Việc điều chỉnh mã sau khi ghi nhận chính thức chỉ dành cho người có quyền, phải có xác nhận và lưu Audit Log gồm giá trị trước, giá trị sau, người thực hiện, thời điểm và lý do.
-   Việc sinh mã tự động phải an toàn khi có nhiều người ghi nhận tài sản đồng thời, bảo đảm không phát sinh mã trùng.
-   Mã tài sản dùng để quản lý nội bộ, không thay thế Serial Number hoặc Agent ID của thiết bị.

------------------------------------------------------------------------

## 8. Các phân hệ chức năng

### 8.1. Dashboard

Hiển thị:

-   Tổng số tài sản.
-   Tài sản đang sử dụng.
-   Tài sản chưa phân bổ.
-   Thiết bị chờ duyệt.
-   Tài sản đang sửa chữa.
-   Tài sản sắp hết bảo hành.
-   Tài sản đã hết bảo hành.
-   Thiết bị Agent offline.
-   Cảnh báo thay đổi cấu hình chưa xử lý.

Biểu đồ:

-   Tài sản theo loại.
-   Tài sản theo phòng ban.
-   Tài sản theo trạng thái.
-   Tài sản theo năm mua.
-   Biến động tài sản.
-   Cảnh báo theo mức độ và thời gian.

### 8.2. Khám phá thiết bị

-   Quản lý dải mạng.
-   Quản lý lịch quét.
-   Danh sách thiết bị phát hiện.
-   Danh sách Agent đăng ký.
-   Thiết bị chưa cài Agent.
-   Thiết bị chờ duyệt.
-   Thiết bị bị bỏ qua.
-   Lịch sử phát hiện và đồng bộ.

### 8.3. Quản lý tài sản

-   Danh sách tài sản.
-   Tìm kiếm theo mã, serial, hostname.
-   Lọc theo loại, phòng ban, người sử dụng, trạng thái.
-   Xem chi tiết tài sản.
-   Cập nhật thông tin quản lý.
-   Xem cấu hình thực tế và Baseline.
-   Xem phần mềm đã cài.
-   Xem thông tin Windows.
-   Xem hồ sơ mua sắm.
-   Xem lịch sử.
-   In QR Code.
-   Xuất Excel/PDF.

Chi tiết tài sản nên chia thành các tab:

1.  Tổng quan.
2.  Cấu hình.
3.  Phần mềm.
4.  Windows và License.
5.  Mua sắm.
6.  Hồ sơ.
7.  Lịch sử thay đổi cấu hình.
8.  Bàn giao và điều chuyển.
9.  Bảo trì.
10. Kiểm kê.

### 8.4. Bàn giao và điều chuyển

Quy trình:

1.  Tạo phiếu điều chuyển.
2.  Chọn tài sản.
3.  Xác định phòng ban/người sử dụng hiện tại.
4.  Chọn phòng ban/người sử dụng mới.
5.  Nhập lý do.
6.  Xác nhận bàn giao.
7.  Lưu lịch sử và cập nhật vị trí hiện tại.

Không cập nhật trực tiếp thông tin người sử dụng hoặc phòng ban mà không
lưu lịch sử nghiệp vụ.

### 8.5. Bảo trì và sửa chữa

-   Tạo phiếu sửa chữa.
-   Ghi nhận tình trạng thiết bị.
-   Ngày tiếp nhận.
-   Đơn vị sửa chữa.
-   Nội dung sửa chữa.
-   Linh kiện thay thế.
-   Chi phí.
-   Ngày hoàn thành.
-   Người thực hiện.
-   File biên bản và chứng từ.

### 8.6. Kiểm kê tài sản

-   Tạo đợt kiểm kê theo cơ sở, phòng ban, loại tài sản hoặc danh sách
    chọn.
-   Quét QR hoặc tìm kiếm mã tài sản.
-   Xác nhận thiết bị thực tế.
-   Ghi nhận vị trí và người sử dụng.
-   Ghi nhận tình trạng.
-   Đánh dấu sai lệch.
-   Hoàn tất và xuất báo cáo.

Trạng thái kiểm kê:

-   Đã kiểm kê.
-   Chưa kiểm kê.
-   Không tìm thấy.
-   Sai vị trí.
-   Sai người sử dụng.
-   Sai cấu hình.
-   Hư hỏng.

### 8.7. Cảnh báo

Các nhóm cảnh báo:

-   Thiết bị mới phát hiện.
-   Thiết bị chưa có tài sản tương ứng.
-   Agent offline quá thời gian quy định.
-   Thay đổi phần cứng.
-   Cài đặt hoặc gỡ phần mềm.
-   Windows chưa kích hoạt hoặc trạng thái thay đổi.
-   Sắp hết bảo hành.
-   Đã hết bảo hành.
-   Kiểm kê quá hạn.
-   Agent phiên bản cũ hoặc lỗi đồng bộ.

Cảnh báo phải có trạng thái: Mới, Đã tiếp nhận, Đang xử lý, Đã xác nhận,
Đã đóng hoặc Bỏ qua.

### 8.8. Báo cáo

-   Danh sách tài sản toàn đơn vị.
-   Tài sản theo phòng ban.
-   Tài sản theo người sử dụng.
-   Tài sản theo loại và trạng thái.
-   Tài sản theo năm mua.
-   Giá trị tài sản.
-   Tài sản sắp hết/hết bảo hành.
-   Thiết bị chưa được ghi nhận.
-   Thiết bị Agent offline.
-   Phần mềm đã cài trên máy tính.
-   Phần mềm không được phép.
-   Lịch sử thay đổi cấu hình.
-   Lịch sử sửa chữa và nâng cấp.
-   Kết quả kiểm kê.

Hỗ trợ lọc dữ liệu và xuất Excel/PDF.

------------------------------------------------------------------------

## 9. Phân quyền và nhật ký

### 9.1. Vai trò đề xuất

  Vai trò             Quyền
  ------------------- --------------------------------------------------------
  System Admin        Quản trị toàn hệ thống, cấu hình và phân quyền
  IT Admin            Quản lý, duyệt, điều chuyển, kiểm kê và xử lý cảnh báo
  IT Staff            Thực hiện nghiệp vụ theo phạm vi được cấp
  Department Viewer   Xem tài sản thuộc phạm vi phòng ban

Phân quyền cần hỗ trợ phạm vi:

-   Toàn đơn vị.
-   Theo cơ sở.
-   Theo phòng ban.
-   Theo loại tài sản.

### 9.2. Audit Log

Ghi nhận các thao tác quan trọng:

-   Người tạo tài sản.
-   Người duyệt tài sản.
-   Người chỉnh sửa thông tin.
-   Giá trị trước và sau khi thay đổi.
-   Người điều chuyển.
-   Người xác nhận kiểm kê.
-   Người xử lý cảnh báo.
-   Người thay đổi cấu hình hệ thống.
-   Thời điểm và địa chỉ truy cập phù hợp.

Không cho phép người dùng thông thường tự sửa hoặc xóa nhật ký kiểm
toán.

------------------------------------------------------------------------

## 10. Thiết kế cơ sở dữ liệu định hướng

Sử dụng MySQL và Prisma ORM. Thiết kế theo nhóm nghiệp vụ, tránh đưa
toàn bộ dữ liệu vào một bảng duy nhất.

### 10.1. Nhóm danh mục và người dùng

  Bảng              Mục đích
  ----------------- --------------
  Departments       Phòng ban
  Users             Người dùng
  Roles             Vai trò
  Permissions       Quyền
  UserRoles         Gán vai trò
  AssetCategories   Nhóm tài sản
  AssetTypes        Loại tài sản
  Locations         Vị trí
  Suppliers         Nhà cung cấp

### 10.2. Nhóm tài sản

  Bảng               Mục đích
  ------------------ ---------------------------
  Assets             Hồ sơ tài sản chính
  AssetPurchases     Thông tin mua sắm
  AssetDocuments     Hồ sơ đính kèm
  AssetAssignments   Lịch sử bàn giao
  AssetTransfers     Lịch sử điều chuyển
  AssetMaintenance   Sửa chữa và bảo trì
  AssetDisposals     Thanh lý
  AssetAuditLogs     Lịch sử nghiệp vụ tài sản

### 10.3. Nhóm Agent và thiết bị

  Bảng                     Mục đích
  ------------------------ ------------------------------------
  DeviceAgents             Định danh và trạng thái Agent
  DiscoveredDevices        Thiết bị phát hiện chưa được duyệt
  DeviceSnapshots          Snapshot cấu hình thực tế
  DeviceBaselines          Cấu hình chuẩn đã xác nhận
  DeviceChanges            Thay đổi phát hiện được
  DeviceProcessors         Chi tiết CPU
  DeviceMemoryModules      Chi tiết RAM
  DeviceDisks              Chi tiết ổ đĩa
  DeviceNetworkAdapters    Card mạng
  DeviceGraphics           GPU
  DeviceMonitors           Màn hình
  DeviceOperatingSystems   Hệ điều hành
  DeviceSoftware           Phần mềm đã cài
  DeviceHeartbeats         Lịch sử heartbeat
  AgentVersions            Phiên bản Agent

### 10.4. Nhóm quét mạng và cảnh báo

  Bảng                    Mục đích
  ----------------------- -----------------------------------
  ScanNetworks            Dải mạng
  ScanSchedules           Lịch quét
  DeviceScans             Lịch sử quét
  AlertRules              Quy tắc cảnh báo
  AlertEvents             Sự kiện cảnh báo
  AlertAcknowledgements   Lịch sử xử lý
  Notifications           Thông báo
  AgentCommands           Lệnh quản trị Agent được giới hạn
  SystemSettings          Cấu hình hệ thống
  AuditLogs               Nhật ký hệ thống

### 10.5. Quy tắc thiết kế dữ liệu

-   Mỗi tài sản có mã duy nhất.
-   Mỗi Agent có định danh duy nhất.
-   Một tài sản có thể liên kết với một Agent đang hoạt động; lịch sử
    liên kết phải được lưu khi thay Agent hoặc thay máy.
-   Một Agent có thể có nhiều Snapshot.
-   Một Snapshot có thể có nhiều thành phần phần cứng và phần mềm.
-   Baseline không bị ghi đè khi có Snapshot mới.
-   Device Change phải tham chiếu Snapshot và Baseline liên quan khi có
    thể.
-   Dữ liệu lịch sử phải có thời điểm thu thập và nguồn dữ liệu.
-   File đính kèm lưu ngoài database; database lưu metadata và đường
    dẫn.
-   Các thao tác duyệt và sinh mã phải được xử lý trong transaction.

------------------------------------------------------------------------

## 11. API và giao tiếp

### 11.1. Nguyên tắc

-   Backend cung cấp REST API.
-   Agent giao tiếp chủ động với Backend qua HTTPS.
-   Xác thực Agent độc lập với xác thực người dùng Web.
-   Có versioning cho API.
-   Có request ID để truy vết.
-   Có idempotency hoặc cơ chế chống ghi nhận trùng khi Agent retry.
-   Payload có schema validation.
-   Có giới hạn kích thước request.
-   Có phân trang cho dữ liệu lớn.

### 11.2. Nhóm API Agent định hướng

  API                         Chức năng
  --------------------------- --------------------------
  POST /api/agent/enroll      Đăng ký Agent
  POST /api/agent/heartbeat   Gửi trạng thái hoạt động
  POST /api/agent/inventory   Gửi inventory
  POST /api/agent/snapshot    Gửi snapshot
  POST /api/agent/events      Gửi sự kiện thay đổi
  GET /api/agent/config       Lấy cấu hình được phép
  GET /api/agent/version      Kiểm tra phiên bản Agent

Đường dẫn trên là định hướng ban đầu, cần được chuẩn hóa trong tài liệu
API trước khi phát triển.

### 11.3. Nguyên tắc bảo mật giao tiếp

-   HTTPS nội bộ.
-   Mỗi Agent có credential riêng.
-   Có cơ chế thu hồi credential.
-   Không dùng một token bất biến chung cho tất cả máy.
-   Không gửi Product Key đầy đủ.
-   Không truyền dữ liệu nhạy cảm không phục vụ nghiệp vụ.
-   Backend chỉ cung cấp cấu hình và lệnh Agent đã được định nghĩa, kiểm
    soát.
-   Không triển khai cơ chế thực thi command tùy ý.

------------------------------------------------------------------------

## 12. Lưu trữ hồ sơ và file

-   Lưu file trên ổ đĩa hoặc vùng lưu trữ nội bộ của máy chủ.
-   Database chỉ lưu metadata và đường dẫn.
-   Hỗ trợ PDF và các định dạng được IT cho phép.
-   Giới hạn dung lượng upload.
-   Kiểm tra MIME type và phần mở rộng.
-   Quét mã độc nếu hạ tầng có hỗ trợ.
-   Không sử dụng tên file do người dùng cung cấp làm đường dẫn lưu trữ
    trực tiếp.
-   Phân quyền tải và xem file.
-   Sao lưu file đồng bộ với database.
-   Có chính sách lưu trữ và phục hồi.

------------------------------------------------------------------------

## 13. Bảo mật và vận hành

### 13.1. Bảo mật

-   Chỉ phục vụ mạng nội bộ.
-   Không công khai API quản trị ra Internet.
-   Sử dụng HTTPS.
-   Phân quyền RBAC.
-   Kiểm soát truy cập theo cơ sở và phòng ban.
-   Agent có danh tính và credential riêng.
-   Có khả năng thu hồi Agent.
-   Ghi nhật ký đăng nhập và thao tác.
-   Kiểm tra file upload.
-   Bảo vệ secret và token.
-   Không lưu mật khẩu Windows.
-   Không thu thập nội dung cá nhân của người dùng.
-   Có cơ chế sao lưu và phục hồi dữ liệu.

### 13.2. Vận hành

-   Theo dõi tình trạng Backend, Database và File Storage.
-   Theo dõi số Agent đang hoạt động.
-   Theo dõi Agent lỗi đồng bộ.
-   Theo dõi dung lượng lưu trữ.
-   Có log tập trung.
-   Có quy trình cập nhật Agent.
-   Có quy trình rollback phiên bản Agent.
-   Có kiểm thử tải khi số lượng máy tăng.
-   Có kiểm thử mất mạng và đồng bộ lại.

------------------------------------------------------------------------

## 14. Menu hệ thống đề xuất

1.  **Tổng quan**
    -   Dashboard.
2.  **Khám phá thiết bị**
    -   Quét mạng.
    -   Danh sách thiết bị phát hiện.
    -   Agent đã đăng ký.
    -   Thiết bị chờ duyệt.
    -   Lịch sử quét.
3.  **Quản lý tài sản**
    -   Danh sách tài sản.
    -   Chi tiết tài sản.
    -   Hồ sơ mua sắm.
    -   Cấu hình thiết bị.
4.  **Bàn giao và điều chuyển**
    -   Phiếu bàn giao.
    -   Phiếu điều chuyển.
    -   Lịch sử sử dụng.
5.  **Bảo trì và sửa chữa**
    -   Phiếu sửa chữa.
    -   Lịch sử bảo trì.
6.  **Kiểm kê**
    -   Đợt kiểm kê.
    -   Kết quả kiểm kê.
    -   Sai lệch kiểm kê.
7.  **Phần mềm và License**
    -   Danh sách phần mềm.
    -   Phần mềm theo thiết bị.
    -   Trạng thái Windows.
    -   Danh sách cần kiểm tra license.
8.  **Cảnh báo**
    -   Thay đổi cấu hình.
    -   Agent offline.
    -   Bảo hành.
    -   Phần mềm.
    -   Cảnh báo khác.
9.  **Báo cáo**
    -   Báo cáo tài sản.
    -   Báo cáo cấu hình.
    -   Báo cáo phần mềm.
    -   Báo cáo kiểm kê.
    -   Báo cáo chi phí.
10. **Danh mục và quản trị**
    -   Phòng ban.
    -   Người dùng.
    -   Loại tài sản.
    -   Nhà cung cấp.
    -   Vị trí.
    -   Phân quyền.
    -   Cấu hình hệ thống.
    -   Nhật ký hệ thống.
    -   Quản lý phiên bản Agent.

------------------------------------------------------------------------

## 15. Lộ trình triển khai

### Giai đoạn 1 -- Nền tảng, Agent và kiểm duyệt tài sản

Phạm vi:

-   Đăng nhập và phân quyền.
-   Danh mục phòng ban, người dùng, loại tài sản.
-   Backend API nền tảng.
-   Windows Agent và cơ chế enrollment.
-   Thu thập CPU, RAM, Disk, Mainboard, GPU, Network.
-   Thu thập Windows và trạng thái kích hoạt.
-   Thu thập danh sách phần mềm.
-   Heartbeat và trạng thái Agent.
-   LAN Discovery cơ bản.
-   Danh sách thiết bị phát hiện.
-   Kiểm tra trùng lặp thiết bị.
-   Quy trình duyệt và sinh mã tài sản.
-   Quản lý hồ sơ mua sắm, bảo hành và file PDF.
-   Dashboard cơ bản.

### Giai đoạn 2 -- Giám sát thay đổi và vòng đời tài sản

Phạm vi:

-   Baseline và Snapshot.
-   So sánh cấu hình.
-   Phát hiện thay đổi phần cứng.
-   Phát hiện cài đặt/gỡ phần mềm.
-   Cảnh báo và quy trình xác minh.
-   Lịch sử cấu hình.
-   Bàn giao và điều chuyển.
-   QR Code.
-   Theo dõi Agent và phiên bản.

### Giai đoạn 3 -- Kiểm kê, bảo trì và cảnh báo nâng cao

Phạm vi:

-   Kiểm kê theo phòng ban.
-   Quét QR.
-   Quản lý sửa chữa và nâng cấp.
-   Cảnh báo bảo hành.
-   Cảnh báo offline.
-   Báo cáo sai lệch.
-   Báo cáo lịch sử tài sản.

### Giai đoạn 4 -- Báo cáo và mở rộng

Phạm vi:

-   Báo cáo quản trị nâng cao.
-   Theo dõi license phần mềm theo phạm vi được phép.
-   Mở rộng thiết bị mạng và ngoại vi.
-   Phân tích chi phí vòng đời tài sản.
-   Tối ưu hiệu năng và khả năng mở rộng.

Thời gian thực hiện cần được ước lượng lại sau khi xác định số lượng
máy, số VLAN, chính sách triển khai Agent, yêu cầu bảo mật và nhân lực
dự án.

------------------------------------------------------------------------

## 16. Tiêu chí nghiệm thu MVP

### 16.1. Windows Agent

-   Cài đặt được trên các phiên bản Windows nằm trong phạm vi hỗ trợ.
-   Tự khởi động cùng Windows.
-   Đăng ký được với Backend.
-   Có Agent ID duy nhất.
-   Thu thập được các trường phần cứng đã thống nhất.
-   Thu thập được Windows và danh sách phần mềm trong giới hạn kỹ thuật.
-   Gửi dữ liệu qua HTTPS.
-   Có heartbeat.
-   Có retry và hàng đợi khi mất mạng.
-   Có log phục vụ xử lý lỗi.

### 16.2. Kiểm duyệt tài sản

-   Thiết bị Agent mới xuất hiện trong danh sách chờ duyệt.
-   IT xem được thông tin cấu hình.
-   IT có thể duyệt hoặc bỏ qua.
-   Khi duyệt, hệ thống sinh mã tài sản duy nhất.
-   Có thể nhập thông tin mua sắm, bảo hành và phòng ban.
-   Có thể đính kèm nhiều hồ sơ.
-   Thiết bị được liên kết với tài sản chính thức.

### 16.3. Giám sát thay đổi

-   Hệ thống lưu được Snapshot.
-   Có Baseline đã xác nhận.
-   Phát hiện được các thay đổi thuộc phạm vi hỗ trợ.
-   Tạo được cảnh báo có giá trị trước và sau.
-   Không tự động cập nhật Baseline.
-   IT có thể xác nhận, từ chối hoặc ghi chú xử lý.
-   Lịch sử thay đổi được lưu.

### 16.4. Quản lý và bảo mật

-   Có phân quyền.
-   Có nhật ký thao tác quan trọng.
-   Có tìm kiếm và lọc tài sản.
-   Có sao lưu database và file.
-   Có cơ chế thu hồi Agent credential.
-   Không lưu Windows Product Key đầy đủ.
-   Không có chức năng thực thi command tùy ý từ Backend.

------------------------------------------------------------------------

## 17. Các vấn đề cần xác nhận trước khi phát triển

Các nội dung dưới đây cần được khảo sát thực tế và chốt trong tài liệu
thiết kế chi tiết:

1.  Các phiên bản Windows Client và Windows Server đang sử dụng.
2.  Máy tính có tham gia Active Directory Domain hay không.
3.  Có thể triển khai MSI hàng loạt qua GPO hay phải cài thủ công.
4.  Số lượng máy tính dự kiến quản lý.
5.  Số lượng VLAN và dải IP cần quét.
6.  Máy chủ Backend đặt tại đâu và có thể truy cập từ toàn bộ VLAN hay
    không.
7.  Có yêu cầu sử dụng chứng thư số nội bộ cho HTTPS hay không.
8.  Chính sách antivirus/EDR có cho phép cài và chạy Agent hay không.
9.  Chu kỳ kiểm kê và thời gian lưu lịch sử cấu hình.
10. Quy tắc mã tài sản hiện tại của đơn vị (nếu đã có).

------------------------------------------------------------------------

## 18. Kết luận và định hướng kiến trúc

Kiến trúc chính thức được đề xuất:

  Thành phần           Công nghệ / giải pháp
  -------------------- ------------------------------------------------
  Frontend             React + Vite + TypeScript
  Backend              NestJS + TypeScript
  ORM                  Prisma
  Database             MySQL
  Windows Agent        C# / .NET Worker Service
  Hardware Inventory   WMI / CIM / Windows API
  Software Inventory   Windows Registry và nguồn hệ thống phù hợp
  Event Monitoring     Windows Event Log / Device Notifications
  Giao tiếp            HTTPS REST API
  LAN Discovery        Quét mạng nội bộ có kiểm soát
  File Storage         Lưu trữ nội bộ trên máy chủ
  Authentication       JWT cho người dùng, credential riêng cho Agent
  Authorization        RBAC và phạm vi dữ liệu

**Kết luận quan trọng:** Windows Agent là nguồn thu thập và giám sát cấu
hình chuyên sâu. LAN Discovery chỉ là công cụ hỗ trợ phát hiện thiết bị
trong mạng. Backend chịu trách nhiệm lưu Snapshot, so sánh Baseline và
phát sinh cảnh báo. IT là bên xác minh và phê duyệt mọi thay đổi ảnh
hưởng đến hồ sơ tài sản chính thức.

Đây là nền tảng để phát triển một hệ thống IT Asset Management thống
nhất, có khả năng mở rộng và phù hợp với môi trường CNTT nội bộ.
