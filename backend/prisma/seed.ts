import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function main() {
  console.log('Seeding IT Asset Management database...');

  // 1. Roles & Granular CRUD Permissions (Xem / Thêm / Sửa / Xóa / Đặc biệt)
  const permissionsData = [
    // Tổng quan
    { code: 'dashboard.read', module: 'Tổng quan', name: 'Xem tổng quan Dashboard' },
    // Khám phá thiết bị & LAN
    { code: 'discovery.read', module: 'Khám phá thiết bị', name: 'Xem danh sách phát hiện & Agent' },
    { code: 'discovery.scan', module: 'Khám phá thiết bị', name: 'Thêm dải mạng & quét LAN' },
    { code: 'discovery.delete', module: 'Khám phá thiết bị', name: 'Xóa dải mạng quét LAN' },
    { code: 'discovery.approve', module: 'Khám phá thiết bị', name: 'Duyệt / bỏ qua thiết bị' },
    // Quản lý tài sản
    { code: 'assets.read', module: 'Quản lý tài sản', name: 'Xem danh sách & chi tiết tài sản' },
    { code: 'assets.create', module: 'Quản lý tài sản', name: 'Thêm tài sản mới' },
    { code: 'assets.update', module: 'Quản lý tài sản', name: 'Sửa thông tin tài sản' },
    { code: 'assets.delete', module: 'Quản lý tài sản', name: 'Xóa tài sản' },
    { code: 'assets.edit_code', module: 'Quản lý tài sản', name: 'Đổi mã tài sản (Audit)' },
    { code: 'assets.documents', module: 'Quản lý tài sản', name: 'Quản lý hồ sơ đính kèm' },
    // Bàn giao & điều chuyển
    { code: 'transfers.read', module: 'Bàn giao & điều chuyển', name: 'Xem lịch sử bàn giao & điều chuyển' },
    { code: 'transfers.create', module: 'Bàn giao & điều chuyển', name: 'Tạo phiếu bàn giao / điều chuyển' },
    { code: 'transfers.update', module: 'Bàn giao & điều chuyển', name: 'Sửa phiếu bàn giao / điều chuyển' },
    { code: 'transfers.delete', module: 'Bàn giao & điều chuyển', name: 'Hủy phiếu bàn giao / điều chuyển' },
    // Bảo trì & sửa chữa
    { code: 'maintenance.read', module: 'Bảo trì & sửa chữa', name: 'Xem phiếu bảo trì & thanh lý' },
    { code: 'maintenance.create', module: 'Bảo trì & sửa chữa', name: 'Tạo phiếu sửa chữa / thanh lý' },
    { code: 'maintenance.update', module: 'Bảo trì & sửa chữa', name: 'Cập nhật tiến độ & hoàn tất' },
    { code: 'maintenance.delete', module: 'Bảo trì & sửa chữa', name: 'Xóa phiếu bảo trì' },
    // Kiểm kê tài sản
    { code: 'inventory.read', module: 'Kiểm kê tài sản', name: 'Xem đợt kiểm kê' },
    { code: 'inventory.create', module: 'Kiểm kê tài sản', name: 'Tạo đợt kiểm kê mới' },
    { code: 'inventory.update', module: 'Kiểm kê tài sản', name: 'Xác nhận kiểm kê & chốt đợt' },
    { code: 'inventory.delete', module: 'Kiểm kê tài sản', name: 'Xóa đợt kiểm kê' },
    // Phần mềm & License
    { code: 'software.read', module: 'Phần mềm & License', name: 'Xem phần mềm & trạng thái Windows' },
    // Cảnh báo & Thay đổi
    { code: 'alerts.read', module: 'Cảnh báo & Thay đổi', name: 'Xem cảnh báo & sai lệch' },
    { code: 'alerts.update', module: 'Cảnh báo & Thay đổi', name: 'Cập nhật trạng thái cảnh báo' },
    { code: 'alerts.verify', module: 'Cảnh báo & Thay đổi', name: 'Xác minh & duyệt Baseline' },
    // Báo cáo
    { code: 'reports.read', module: 'Báo cáo', name: 'Xem báo cáo quản trị' },
    { code: 'reports.export', module: 'Báo cáo', name: 'Xuất báo cáo CSV/Excel' },
    // Danh mục hệ thống
    { code: 'catalogs.read', module: 'Danh mục hệ thống', name: 'Xem danh mục' },
    { code: 'catalogs.create', module: 'Danh mục hệ thống', name: 'Thêm danh mục' },
    { code: 'catalogs.update', module: 'Danh mục hệ thống', name: 'Sửa danh mục' },
    { code: 'catalogs.delete', module: 'Danh mục hệ thống', name: 'Xóa danh mục' },
    // Người dùng & Phân quyền
    { code: 'users.read', module: 'Người dùng & Phân quyền', name: 'Xem người dùng & nhóm quyền' },
    { code: 'users.create', module: 'Người dùng & Phân quyền', name: 'Thêm người dùng' },
    { code: 'users.update', module: 'Người dùng & Phân quyền', name: 'Sửa / khóa người dùng' },
    { code: 'users.delete', module: 'Người dùng & Phân quyền', name: 'Xóa người dùng' },
    // Cấu hình hệ thống & Agent
    { code: 'settings.read', module: 'Cấu hình & Agent', name: 'Xem cấu hình & phiên bản Agent' },
    { code: 'settings.create', module: 'Cấu hình & Agent', name: 'Tạo Token & phát hành Agent' },
    { code: 'settings.update', module: 'Cấu hình & Agent', name: 'Sửa cấu hình & quy tắc cảnh báo' },
    { code: 'settings.delete', module: 'Cấu hình & Agent', name: 'Thu hồi Agent & Token' },
    // Nhật ký hệ thống
    { code: 'admin.audit', module: 'Nhật ký hệ thống', name: 'Xem nhật ký Audit Log' },
  ];

  // Clean up deprecated coarse permission codes if upgrading existing DB
  const validCodes = permissionsData.map((p) => p.code);
  await prisma.permission.deleteMany({ where: { code: { notIn: validCodes } } });

  const perms: Record<string, string> = {};
  for (const p of permissionsData) {
    const rec = await prisma.permission.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    perms[p.code] = rec.id;
  }

  const rolesDef = [
    {
      code: 'SYSTEM_ADMIN',
      name: 'System Admin',
      description: 'Quản trị toàn hệ thống, cấu hình và phân quyền',
      perms: Object.keys(perms),
    },
    {
      code: 'IT_ADMIN',
      name: 'IT Admin',
      description: 'Quản lý, duyệt tài sản, điều chuyển, kiểm kê và xử lý cảnh báo',
      perms: Object.keys(perms).filter((c) => !c.startsWith('users.')),
    },
    {
      code: 'IT_STAFF',
      name: 'IT Staff',
      description: 'Thực hiện nghiệp vụ vận hành CNTT hằng ngày',
      perms: [
        'dashboard.read',
        'discovery.read',
        'discovery.scan',
        'assets.read',
        'assets.create',
        'assets.update',
        'assets.documents',
        'transfers.read',
        'transfers.create',
        'maintenance.read',
        'maintenance.create',
        'maintenance.update',
        'inventory.read',
        'inventory.create',
        'inventory.update',
        'software.read',
        'alerts.read',
        'alerts.update',
        'reports.read',
        'reports.export',
        'catalogs.read',
      ],
    },
    {
      code: 'DEPARTMENT_VIEWER',
      name: 'Department Viewer',
      description: 'Xem tài sản thuộc phạm vi phòng ban được phân công',
      perms: ['dashboard.read', 'assets.read', 'transfers.read', 'maintenance.read', 'inventory.read', 'software.read', 'reports.read'],
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesDef) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description },
    });
    roles[r.code] = role.id;
    for (const pCode of r.perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perms[pCode] } },
        update: {},
        create: { roleId: role.id, permissionId: perms[pCode] },
      });
    }
  }

  // 2. Departments
  const deptSeed = [
    { code: 'IT', name: 'Phòng Công nghệ Thông tin', description: 'Vận hành hạ tầng và quản lý tài sản CNTT' },
    { code: 'QA', name: 'Phòng Đảm bảo Chất lượng (QA)', description: 'Kiểm thử và đảm bảo chất lượng phần mềm' },
    { code: 'FIN', name: 'Phòng Kế toán - Tài chính', description: 'Kế toán, tài chính và mua sắm' },
    { code: 'HR', name: 'Phòng Hành chính - Nhân sự', description: 'Nhân sự và hành chính tổng hợp' },
    { code: 'BIZ', name: 'Phòng Kinh doanh', description: 'Kinh doanh và chăm sóc khách hàng' },
    { code: 'BOD', name: 'Ban Giám đốc', description: 'Ban điều hành đơn vị' },
  ];
  const depts: Record<string, string> = {};
  for (const d of deptSeed) {
    const rec = await prisma.department.upsert({ where: { code: d.code }, update: d, create: d });
    depts[d.code] = rec.id;
  }

  // 3. Locations
  const locSeed = [
    { code: 'F3-IT', name: 'Tầng 3 - Phòng Máy chủ & IT', building: 'Tòa nhà A', floor: 'Tầng 3', room: 'P.301' },
    { code: 'F4-QA', name: 'Tầng 4 - Khu vực QA Lab', building: 'Tòa nhà A', floor: 'Tầng 4', room: 'P.402' },
    { code: 'F2-FIN', name: 'Tầng 2 - Phòng Tài chính Kế toán', building: 'Tòa nhà A', floor: 'Tầng 2', room: 'P.205' },
    { code: 'F2-HR', name: 'Tầng 2 - Phòng Hành chính Nhân sự', building: 'Tòa nhà A', floor: 'Tầng 2', room: 'P.201' },
    { code: 'WAREHOUSE', name: 'Kho thiết bị CNTT - Tầng 1', building: 'Tòa nhà A', floor: 'Tầng 1', room: 'Kho IT' },
    { code: 'F5-BIZ', name: 'Tầng 5 - Phòng Kinh doanh', building: 'Tòa nhà A', floor: 'Tầng 5', room: 'P.504' },
  ];
  const locs: Record<string, string> = {};
  for (const l of locSeed) {
    const rec = await prisma.location.upsert({ where: { code: l.code }, update: l, create: l });
    locs[l.code] = rec.id;
  }

  // 4. Suppliers
  const supSeed = [
    { code: 'FPT-SYN', name: 'Công ty TNHH Phân phối Synnex FPT', taxCode: '0101500001', contactName: 'Nguyễn Minh Quân', phone: '024-7300-8888', email: 'b2b@synnexfpt.vn', address: 'Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội' },
    { code: 'DGW', name: 'Công ty Cổ phần Thế Giới Số (Digiworld)', taxCode: '0302861742', contactName: 'Trần Thị Mai Anh', phone: '028-3929-0059', email: 'enterprise@dgw.com.vn', address: '195-197 Nguyễn Thái Bình, Quận 1, TP.HCM' },
    { code: 'CMC-TS', name: 'Công ty TNHH Công nghệ và Giải pháp CMC', taxCode: '0100244112', contactName: 'Lê Hoàng Nam', phone: '024-3795-8668', email: 'sales@cmcts.com.vn', address: 'Tòa nhà CMC, Duy Tân, Hà Nội' },
    { code: 'HACOM', name: 'Công ty Cổ phần Đầu tư Công nghệ HACOM', taxCode: '0101161194', contactName: 'Phạm Đức Thắng', phone: '1900-1903', email: 'duan@hacom.vn', address: '131 Lê Thanh Nghị, Hai Bà Trưng, Hà Nội' },
  ];
  const sups: Record<string, string> = {};
  for (const s of supSeed) {
    const rec = await prisma.supplier.upsert({ where: { code: s.code }, update: s, create: s });
    sups[s.code] = rec.id;
  }

  // 5. Asset Categories & Asset Types
  const catSeed = [
    { code: 'COMPUTE', name: 'Máy tính & Máy chủ', description: 'Desktop, Laptop, Windows Server có hỗ trợ Windows Agent' },
    { code: 'PERIPHERAL', name: 'Thiết bị ngoại vi', description: 'Màn hình, máy in, máy scan, thiết bị hội nghị' },
    { code: 'NETWORK', name: 'Thiết bị mạng & Hạ tầng', description: 'Switch, Router, Firewall, Access Point, UPS' },
  ];
  const cats: Record<string, string> = {};
  for (const c of catSeed) {
    const rec = await prisma.assetCategory.upsert({ where: { code: c.code }, update: c, create: c });
    cats[c.code] = rec.id;
  }

  const typeSeed = [
    { code: 'PC', name: 'Máy tính để bàn (Desktop)', categoryId: cats.COMPUTE, supportsAgent: true },
    { code: 'LT', name: 'Máy tính xách tay (Laptop)', categoryId: cats.COMPUTE, supportsAgent: true },
    { code: 'SV', name: 'Máy chủ Windows (Server)', categoryId: cats.COMPUTE, supportsAgent: true },
    { code: 'MN', name: 'Màn hình (Monitor)', categoryId: cats.PERIPHERAL, supportsAgent: false },
    { code: 'PR', name: 'Máy in / Máy scan', categoryId: cats.PERIPHERAL, supportsAgent: false },
    { code: 'NW', name: 'Thiết bị mạng (Switch/Router/FW)', categoryId: cats.NETWORK, supportsAgent: false },
    { code: 'UP', name: 'Bộ lưu điện (UPS)', categoryId: cats.NETWORK, supportsAgent: false },
  ];
  const types: Record<string, string> = {};
  for (const t of typeSeed) {
    const rec = await prisma.assetType.upsert({ where: { code: t.code }, update: t, create: t });
    types[t.code] = rec.id;
  }

  // 6. Users (one per RBAC role + regular assignees)
  const defaultPassHash = await bcrypt.hash('Admin@123', 10);
  const userSeed = [
    { username: 'sysadmin', email: 'sysadmin@corp.local', fullName: 'Nguyễn Quản Trị', employeeCode: 'NV001', title: 'Trưởng phòng CNTT', departmentId: depts.IT, roleCode: 'SYSTEM_ADMIN', scopeType: 'ORGANIZATION' },
    { username: 'itadmin', email: 'itadmin@corp.local', fullName: 'Trần Minh Đức', employeeCode: 'NV002', title: 'Quản trị viên hệ thống IT', departmentId: depts.IT, roleCode: 'IT_ADMIN', scopeType: 'ORGANIZATION' },
    { username: 'itstaff', email: 'itstaff@corp.local', fullName: 'Lê Văn Hùng', employeeCode: 'NV003', title: 'Chuyên viên Helpdesk IT', departmentId: depts.IT, roleCode: 'IT_STAFF', scopeType: 'ORGANIZATION' },
    { username: 'qaviewer', email: 'qaviewer@corp.local', fullName: 'Phạm Thu Hà', employeeCode: 'NV010', title: 'Trưởng nhóm QA', departmentId: depts.QA, roleCode: 'DEPARTMENT_VIEWER', scopeType: 'DEPARTMENT' },
    { username: 'finuser', email: 'ketoan@corp.local', fullName: 'Hoàng Ngọc Lan', employeeCode: 'NV022', title: 'Kế toán trưởng', departmentId: depts.FIN, roleCode: 'DEPARTMENT_VIEWER', scopeType: 'DEPARTMENT' },
    { username: 'hruser', email: 'nhansu@corp.local', fullName: 'Vũ Thị Hạnh', employeeCode: 'NV031', title: 'Chuyên viên Nhân sự', departmentId: depts.HR, roleCode: 'DEPARTMENT_VIEWER', scopeType: 'DEPARTMENT' },
    { username: 'bizuser', email: 'kinhdoanh@corp.local', fullName: 'Đặng Quốc Bảo', employeeCode: 'NV045', title: 'Trưởng phòng Kinh doanh', departmentId: depts.BIZ, roleCode: 'DEPARTMENT_VIEWER', scopeType: 'DEPARTMENT' },
  ];

  const users: Record<string, string> = {};
  for (const u of userSeed) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, departmentId: u.departmentId, title: u.title },
      create: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        passwordHash: defaultPassHash,
        employeeCode: u.employeeCode,
        title: u.title,
        departmentId: u.departmentId,
      },
    });
    users[u.username] = user.id;

    const existingRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: roles[u.roleCode] } });
    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roles[u.roleCode],
          scopeType: u.scopeType,
          departmentId: u.scopeType === 'DEPARTMENT' ? u.departmentId : null,
        },
      });
    }
  }

  // 7. System Settings (SRS 5.7 & 7.3)
  const settingsSeed = [
    { key: 'asset_code.pattern', value: 'IT-{TYPE}-{YEAR}-{SEQ}', group: 'ASSET_CODE', description: 'Định dạng sinh mã tài sản tự động' },
    { key: 'asset_code.seq_padding', value: '4', group: 'ASSET_CODE', description: 'Số chữ số thứ tự (VD: 4 -> 0001)' },
    { key: 'asset_code.allow_manual', value: 'true', group: 'ASSET_CODE', description: 'Cho phép nhập mã tài sản thủ công tùy chỉnh' },
    { key: 'agent.heartbeat_interval_sec', value: '300', group: 'AGENT_SCHEDULE', description: 'Chu kỳ gửi Heartbeat (5 phút = 300 giây)' },
    { key: 'agent.hardware_interval_sec', value: '1800', group: 'AGENT_SCHEDULE', description: 'Chu kỳ kiểm tra CPU/RAM/Disk (30 phút)' },
    { key: 'agent.software_interval_sec', value: '21600', group: 'AGENT_SCHEDULE', description: 'Chu kỳ kiểm tra phần mềm (6 giờ)' },
    { key: 'agent.license_interval_sec', value: '86400', group: 'AGENT_SCHEDULE', description: 'Chu kỳ kiểm tra Windows License (24 giờ)' },
    { key: 'agent.full_snapshot_interval_sec', value: '86400', group: 'AGENT_SCHEDULE', description: 'Chu kỳ Snapshot đầy đủ (24 giờ)' },
    { key: 'agent.jitter_max_sec', value: '60', group: 'AGENT_SCHEDULE', description: 'Độ trễ ngẫu nhiên (jitter) tránh nghẽn tải' },
    { key: 'agent.offline_threshold_min', value: '15', group: 'ALERT', description: 'Thời gian mất Heartbeat để đánh dấu Agent offline (phút)' },
    { key: 'warranty.expiring_days', value: '60', group: 'ALERT', description: 'Số ngày cảnh báo trước khi hết bảo hành' },
    { key: 'software.unauthorized_keywords', value: 'uTorrent,BitTorrent,Crack,KMSpico,TeamViewer,AnyDesk', group: 'SECURITY', description: 'Từ khóa phần mềm cần kiểm tra / không được phép' },
  ];
  for (const s of settingsSeed) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: s, create: s });
  }

  // 8. Alert Rules (SRS 5.6 - configurable severity, not hardcoded)
  const alertRulesSeed = [
    { code: 'HARDWARE_CPU_CHANGE', name: 'Thay đổi bộ vi xử lý (CPU)', category: 'CONFIG_CHANGE', severity: 'HIGH', description: 'Phát hiện thay đổi model, số core hoặc luồng CPU so với Baseline' },
    { code: 'HARDWARE_MAINBOARD_CHANGE', name: 'Thay đổi bo mạch chủ (Mainboard)', category: 'CONFIG_CHANGE', severity: 'HIGH', description: 'Phát hiện thay đổi bo mạch chủ hoặc serial Mainboard' },
    { code: 'HARDWARE_RAM_CHANGE', name: 'Thay đổi dung lượng / thanh RAM', category: 'CONFIG_CHANGE', severity: 'MEDIUM', description: 'Thêm, tháo hoặc thay thế module RAM so với Baseline' },
    { code: 'HARDWARE_DISK_CHANGE', name: 'Thay đổi ổ đĩa lưu trữ (Disk)', category: 'CONFIG_CHANGE', severity: 'HIGH', description: 'Thêm, tháo hoặc thay ổ đĩa hệ thống/dữ liệu' },
    { code: 'HARDWARE_GPU_CHANGE', name: 'Thay đổi card đồ họa (GPU)', category: 'CONFIG_CHANGE', severity: 'MEDIUM', description: 'Thêm, tháo hoặc thay đổi GPU' },
    { code: 'WINDOWS_ACTIVATION_CHANGE', name: 'Thay đổi trạng thái kích hoạt Windows', category: 'CONFIG_CHANGE', severity: 'HIGH', description: 'Windows mất kích hoạt hoặc thay đổi edition/build' },
    { code: 'SOFTWARE_CHANGE', name: 'Cài đặt hoặc gỡ bỏ phần mềm', category: 'SOFTWARE', severity: 'INFO', description: 'Phát hiện cài mới, gỡ bỏ hoặc cập nhật phiên bản ứng dụng' },
    { code: 'SOFTWARE_UNAUTHORIZED', name: 'Phát hiện phần mềm không được phép', category: 'SOFTWARE', severity: 'HIGH', description: 'Ứng dụng nằm trong danh sách cần kiểm tra / cấm sử dụng nội bộ' },
    { code: 'AGENT_OFFLINE', name: 'Windows Agent mất kết nối (Offline)', category: 'AGENT_OFFLINE', severity: 'MEDIUM', threshold: '15', description: 'Agent không gửi heartbeat vượt quá ngưỡng thời gian quy định' },
    { code: 'AGENT_IDENTITY_CONFLICT', name: 'Mâu thuẫn định danh thiết bị / Agent bị vô hiệu hóa', category: 'SECURITY', severity: 'CRITICAL', description: 'Trùng lặp SMBIOS UUID/Serial hoặc nghi ngờ can thiệp Agent' },
    { code: 'WARRANTY_EXPIRING', name: 'Tài sản sắp hết bảo hành', category: 'WARRANTY', severity: 'MEDIUM', threshold: '60', description: 'Cảnh báo tài sản còn dưới 60 ngày bảo hành' },
    { code: 'WARRANTY_EXPIRED', name: 'Tài sản đã hết bảo hành', category: 'WARRANTY', severity: 'INFO', description: 'Tài sản đã vượt quá thời hạn bảo hành nhà sản xuất' },
    { code: 'DEVICE_NEW_DISCOVERED', name: 'Phát hiện thiết bị mới trong mạng nội bộ', category: 'DISCOVERY', severity: 'INFO', description: 'Agent mới đăng ký hoặc LAN Discovery phát hiện thiết bị chưa duyệt' },
  ];
  for (const r of alertRulesSeed) {
    await prisma.alertRule.upsert({ where: { code: r.code }, update: r, create: r });
  }

  // 9. Agent Versions & Enrollment Tokens
  const verSeed = [
    { version: '1.0.0', releaseNotes: 'Phiên bản MVP thu thập WMI/CIM, Registry Software và Heartbeat', downloadUrl: '/downloads/ITAssetAgent-1.0.0.msi', sha256Hash: sha256('agent-1.0.0'), isLatest: false, isMandatory: false, releasedAt: new Date('2026-06-01') },
    { version: '1.1.0', releaseNotes: 'Bổ sung hàng đợi offline cục bộ, jitter đồng bộ và giám sát Event Log', downloadUrl: '/downloads/ITAssetAgent-1.1.0.msi', sha256Hash: sha256('agent-1.1.0'), isLatest: false, isMandatory: false, releasedAt: new Date('2026-09-15') },
    { version: '1.2.0', releaseNotes: 'Tối ưu đọc EDID màn hình, bảo vệ credential bằng DPAPI và chống trùng lặp snapshot', downloadUrl: '/downloads/ITAssetAgent-1.2.0.msi', sha256Hash: sha256('agent-1.2.0'), isLatest: true, isMandatory: false, releasedAt: new Date('2026-11-01') },
  ];
  for (const v of verSeed) {
    await prisma.agentVersion.upsert({ where: { version: v.version }, update: v, create: v });
  }

  // Demo Enrollment Token: "ENROLL-ITAM-2026-INTERNAL"
  const rawEnrollToken = 'ENROLL-ITAM-2026-INTERNAL';
  await prisma.enrollmentToken.upsert({
    where: { tokenHash: sha256(rawEnrollToken) },
    update: { isRevoked: false, expiresAt: new Date('2027-12-31') },
    create: {
      name: 'Token triển khai GPO Q4/2026',
      tokenHash: sha256(rawEnrollToken),
      tokenPreview: 'ENROLL-ITAM-...INTERNAL',
      maxUses: 500,
      usedCount: 7,
      expiresAt: new Date('2027-12-31'),
      createdById: users.sysadmin,
    },
  });

  // Check if assets already seeded so script is idempotent
  const existingAssetCount = await prisma.asset.count();
  if (existingAssetCount > 0) {
    console.log(`Database already has ${existingAssetCount} assets. Skipping sample asset re-creation.`);
    return;
  }

  // 10. Official Assets + Purchases + Agents + Snapshots + Confirmed Baselines
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  // Asset 1: The EXACT SRS 5.5 example! IT-PC-2026-0001 / TMTDM-IT-001 (Baseline RAM 8GB -> Latest Snapshot RAM 16GB!)
  const asset1 = await prisma.asset.create({
    data: {
      assetCode: 'IT-PC-2026-0001',
      codeMode: 'AUTO',
      name: 'Máy trạm kỹ thuật IT - TMTDM-IT-001',
      categoryId: cats.COMPUTE,
      assetTypeId: types.PC,
      status: 'IN_USE',
      serialNumber: 'DL-OPT7010-99101',
      qrCodeValue: 'ITAM:IT-PC-2026-0001',
      manufacturer: 'Dell Inc.',
      model: 'OptiPlex 7010 Tower',
      hostname: 'TMTDM-IT-001',
      managingDepartmentId: depts.IT,
      usingDepartmentId: depts.IT,
      assignedUserId: users.itadmin,
      assignedUserName: 'Trần Minh Đức',
      locationId: locs['F3-IT'],
      locationDetail: 'Bàn kỹ thuật số 01',
      handoverDate: new Date('2026-10-01'),
      handoverBy: 'Nguyễn Quản Trị',
      receivedBy: 'Trần Minh Đức',
      approvedById: users.sysadmin,
      approvedAt: new Date('2026-10-01'),
      createdById: users.sysadmin,
      officialSpecsJson: JSON.stringify({
        cpu: 'Intel Core i7-13700 (16C/24T)',
        ramTotalGb: 8,
        disks: 'Samsung PM9A1 NVMe 512 GB',
        os: 'Windows 11 Pro 23H2 (Activated)',
      }),
      notes: 'Máy trạm quản trị hạ tầng - Baseline duyệt ngày 01/10/2026',
    },
  });

  await prisma.assetPurchase.create({
    data: {
      assetId: asset1.id,
      purchaseDate: new Date('2026-09-20'),
      inUseDate: new Date('2026-10-01'),
      supplierId: sups['FPT-SYN'],
      contractNumber: 'HD-2026/09-FPT',
      invoiceNumber: 'INV-0004821',
      purchasePrice: 24500000,
      fundingSource: 'Ngân sách CNTT 2026',
      warrantyStartDate: new Date('2026-09-20'),
      warrantyEndDate: new Date('2029-09-20'),
    },
  });

  // Create a real sample PDF file on disk for Asset 1 so document download works immediately!
  const uploadDir = path.resolve(process.cwd(), 'storage', 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const samplePdfName = 'seed-handover-IT-PC-2026-0001.pdf';
  const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT /F1 14 Tf 50 720 Td (BIEN BAN BAN GIAO TAI SAN CNTT - IT-PC-2026-0001) Tj 0 -24 Td (Hostname: TMTDM-IT-001 | Dell OptiPlex 7010 Tower) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000412 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
482
%%EOF`;
  fs.writeFileSync(path.join(uploadDir, samplePdfName), samplePdfContent);

  await prisma.assetDocument.create({
    data: {
      assetId: asset1.id,
      docType: 'HANDOVER',
      originalName: 'Bien_ban_ban_giao_IT-PC-2026-0001.pdf',
      storedName: samplePdfName,
      mimeType: 'application/pdf',
      sizeBytes: Buffer.byteLength(samplePdfContent),
      storagePath: path.join('storage', 'uploads', samplePdfName),
      notes: 'Biên bản bàn giao đã ký xác nhận giữa IT và người sử dụng',
      uploadedById: users.sysadmin,
    },
  });

  const agent1 = await prisma.deviceAgent.create({
    data: {
      agentUid: 'AGT-TMTDM-IT-001',
      credentialHash: sha256('demo-agent-token-001'),
      status: 'ONLINE',
      agentVersion: '1.2.0',
      hostname: 'TMTDM-IT-001',
      computerName: 'TMTDM-IT-001',
      smbiosUuid: '4C4C4544-0039-3910-8031-B1C04F313031',
      biosSerial: 'DL-OPT7010-99101',
      primaryMac: 'D4:BE:D9:10:4A:01',
      lastIpAddress: '192.168.10.21',
      manufacturer: 'Dell Inc.',
      model: 'OptiPlex 7010 Tower',
      osSummary: 'Windows 11 Pro 23H2',
      enrolledAt: new Date('2026-10-01T08:30:00Z'),
      lastHeartbeatAt: minsAgo(2),
      lastSnapshotAt: minsAgo(12),
      assetId: asset1.id,
    },
  });

  await prisma.assetAgentLink.create({
    data: { assetId: asset1.id, agentId: agent1.id, linkedAt: new Date('2026-10-01T08:45:00Z'), reason: 'Duyệt tài sản ban đầu' },
  });

  // Baseline snapshot for Agent 1 (8 GB RAM on 01/10/2026)
  const snap1Base = await prisma.deviceSnapshot.create({
    data: {
      agentId: agent1.id,
      source: 'INITIAL',
      collectedAt: new Date('2026-10-01T08:35:00Z'),
      computerName: 'TMTDM-IT-001',
      hostname: 'TMTDM-IT-001',
      smbiosUuid: agent1.smbiosUuid,
      serialNumber: 'DL-OPT7010-99101',
      manufacturer: 'Dell Inc.',
      model: 'OptiPlex 7010 Tower',
      mainboardMfg: 'Dell Inc.',
      mainboardProduct: '0Y8W4N',
      mainboardSerial: 'MB-DL-7010-001',
      biosMfg: 'Dell Inc.',
      biosVersion: '1.14.0',
      biosReleaseDate: '2026-05-12',
      biosSerial: 'DL-OPT7010-99101',
      totalRamGb: 8,
      totalDiskGb: 512,
      processors: {
        create: [{ name: 'Intel(R) Core(TM) i7-13700', manufacturer: 'GenuineIntel', cores: 16, logicalProcessors: 24, maxClockMhz: 5200 }],
      },
      memoryModules: {
        create: [{ slot: 'DIMM1', capacityGb: 8, memoryType: 'DDR4', speedMhz: 3200, manufacturer: 'SK Hynix', serialNumber: 'HYN-8G-001122' }],
      },
      disks: {
        create: [{ model: 'Samsung PM9A1 NVMe 512GB', serialNumber: 'S64GNE0R800101', mediaType: 'NVMe SSD', sizeGb: 512, freeGb: 318.4, partitions: 'C: (NTFS 511 GB)' }],
      },
      networkAdapters: {
        create: [{ name: 'Intel(R) Ethernet Connection (17) I219-LM', macAddress: 'D4:BE:D9:10:4A:01', ipAddress: '192.168.10.21', speedMbps: 1000, status: 'UP', isVirtual: false }],
      },
      graphics: {
        create: [{ name: 'Intel(R) UHD Graphics 770', vramMb: 1024, driverVersion: '31.0.101.5333' }],
      },
      monitors: {
        create: [{ manufacturer: 'Dell', model: 'Dell P2422H', serialNumber: 'CN-0P2422H-0192', resolution: '1920x1080' }],
      },
      operatingSystem: {
        create: {
          productName: 'Windows 11 Pro',
          edition: 'Professional',
          version: '23H2',
          buildNumber: '22631.4317',
          architecture: '64-bit',
          installDate: new Date('2026-09-25'),
          lastBootTime: hoursAgo(6),
          activationStatus: 'ACTIVATED',
          licenseDescription: 'Windows(R) Operating System, OEM_DM channel',
          licenseChannel: 'OEM',
          partialProductKey: '3V66T',
        },
      },
      software: {
        create: [
          { displayName: 'Microsoft Office LTSC Professional Plus 2021', publisher: 'Microsoft Corporation', displayVersion: '16.0.14332.20771', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'Google Chrome', publisher: 'Google LLC', displayVersion: '130.0.6723.92', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'Visual Studio Code', publisher: 'Microsoft Corporation', displayVersion: '1.94.2', installDate: '2026-10-01', architecture: 'x64' },
          { displayName: '7-Zip 24.08 (x64)', publisher: 'Igor Pavlov', displayVersion: '24.08', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'FortiClient VPN', publisher: 'Fortinet Inc.', displayVersion: '7.2.4', installDate: '2026-09-26', architecture: 'x64' },
        ],
      },
    },
  });

  const baseline1 = await prisma.deviceBaseline.create({
    data: {
      assetId: asset1.id,
      agentId: agent1.id,
      snapshotId: snap1Base.id,
      version: 1,
      isActive: true,
      confirmedById: users.sysadmin,
      confirmedAt: new Date('2026-10-01T09:00:00Z'),
      notes: 'Baseline cấu hình ban đầu khi bàn giao',
      baselineJson: JSON.stringify({
        cpu: 'Intel(R) Core(TM) i7-13700 (16C/24T)',
        totalRamGb: 8,
        memoryModules: ['DIMM1: 8 GB DDR4 3200MHz (SK Hynix)'],
        disks: ['Samsung PM9A1 NVMe 512GB (512 GB)'],
        mainboard: 'Dell Inc. 0Y8W4N (MB-DL-7010-001)',
        bios: 'Dell Inc. 1.14.0',
        gpu: ['Intel(R) UHD Graphics 770'],
        os: 'Windows 11 Pro 23H2 (22631.4317)',
        activationStatus: 'ACTIVATED',
        software: [
          'Microsoft Office LTSC Professional Plus 2021|16.0.14332.20771',
          'Google Chrome|130.0.6723.92',
          'Visual Studio Code|1.94.2',
          '7-Zip 24.08 (x64)|24.08',
          'FortiClient VPN|7.2.4',
        ],
      }),
    },
  });

  // Latest snapshot for Agent 1 (16 GB RAM detected! -> Unapproved DeviceChange + Alert matching SRS 5.5)
  const snap1Latest = await prisma.deviceSnapshot.create({
    data: {
      agentId: agent1.id,
      source: 'PERIODIC',
      collectedAt: minsAgo(12),
      computerName: 'TMTDM-IT-001',
      hostname: 'TMTDM-IT-001',
      smbiosUuid: agent1.smbiosUuid,
      serialNumber: 'DL-OPT7010-99101',
      manufacturer: 'Dell Inc.',
      model: 'OptiPlex 7010 Tower',
      mainboardMfg: 'Dell Inc.',
      mainboardProduct: '0Y8W4N',
      mainboardSerial: 'MB-DL-7010-001',
      biosMfg: 'Dell Inc.',
      biosVersion: '1.14.0',
      biosReleaseDate: '2026-05-12',
      biosSerial: 'DL-OPT7010-99101',
      totalRamGb: 16,
      totalDiskGb: 512,
      processors: {
        create: [{ name: 'Intel(R) Core(TM) i7-13700', manufacturer: 'GenuineIntel', cores: 16, logicalProcessors: 24, maxClockMhz: 5200 }],
      },
      memoryModules: {
        create: [
          { slot: 'DIMM1', capacityGb: 8, memoryType: 'DDR4', speedMhz: 3200, manufacturer: 'SK Hynix', serialNumber: 'HYN-8G-001122' },
          { slot: 'DIMM2', capacityGb: 8, memoryType: 'DDR4', speedMhz: 3200, manufacturer: 'Kingston', serialNumber: 'KST-8G-998811' },
        ],
      },
      disks: {
        create: [{ model: 'Samsung PM9A1 NVMe 512GB', serialNumber: 'S64GNE0R800101', mediaType: 'NVMe SSD', sizeGb: 512, freeGb: 294.1, partitions: 'C: (NTFS 511 GB)' }],
      },
      networkAdapters: {
        create: [{ name: 'Intel(R) Ethernet Connection (17) I219-LM', macAddress: 'D4:BE:D9:10:4A:01', ipAddress: '192.168.10.21', speedMbps: 1000, status: 'UP', isVirtual: false }],
      },
      graphics: {
        create: [{ name: 'Intel(R) UHD Graphics 770', vramMb: 1024, driverVersion: '31.0.101.5333' }],
      },
      monitors: {
        create: [{ manufacturer: 'Dell', model: 'Dell P2422H', serialNumber: 'CN-0P2422H-0192', resolution: '1920x1080' }],
      },
      operatingSystem: {
        create: {
          productName: 'Windows 11 Pro',
          edition: 'Professional',
          version: '23H2',
          buildNumber: '22631.4317',
          architecture: '64-bit',
          installDate: new Date('2026-09-25'),
          lastBootTime: hoursAgo(2),
          activationStatus: 'ACTIVATED',
          licenseDescription: 'Windows(R) Operating System, OEM_DM channel',
          licenseChannel: 'OEM',
          partialProductKey: '3V66T',
        },
      },
      software: {
        create: [
          { displayName: 'Microsoft Office LTSC Professional Plus 2021', publisher: 'Microsoft Corporation', displayVersion: '16.0.14332.20771', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'Google Chrome', publisher: 'Google LLC', displayVersion: '130.0.6723.92', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'Visual Studio Code', publisher: 'Microsoft Corporation', displayVersion: '1.95.0', installDate: '2026-11-18', architecture: 'x64' },
          { displayName: '7-Zip 24.08 (x64)', publisher: 'Igor Pavlov', displayVersion: '24.08', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'FortiClient VPN', publisher: 'Fortinet Inc.', displayVersion: '7.2.4', installDate: '2026-09-26', architecture: 'x64' },
          { displayName: 'Docker Desktop', publisher: 'Docker Inc.', displayVersion: '4.35.1', installDate: '2026-11-18', architecture: 'x64' },
        ],
      },
    },
  });

  const changeRam = await prisma.deviceChange.create({
    data: {
      assetId: asset1.id,
      agentId: agent1.id,
      baselineId: baseline1.id,
      snapshotId: snap1Latest.id,
      component: 'RAM',
      changeType: 'MODIFIED',
      previousValue: '8 GB (1x8GB DDR4 3200MHz SK Hynix)',
      newValue: '16 GB (1x8GB SK Hynix + 1x8GB Kingston DDR4 3200MHz)',
      severity: 'MEDIUM',
      status: 'PENDING',
      source: 'BASELINE_DIFF',
      detectedAt: minsAgo(12),
    },
  });

  const changeSw = await prisma.deviceChange.create({
    data: {
      assetId: asset1.id,
      agentId: agent1.id,
      baselineId: baseline1.id,
      snapshotId: snap1Latest.id,
      component: 'SOFTWARE',
      changeType: 'ADDED',
      previousValue: 'Chưa cài đặt',
      newValue: 'Docker Desktop 4.35.1 (Docker Inc.)',
      severity: 'INFO',
      status: 'PENDING',
      source: 'BASELINE_DIFF',
      detectedAt: minsAgo(12),
    },
  });

  await prisma.alertEvent.create({
    data: {
      ruleCode: 'HARDWARE_RAM_CHANGE',
      category: 'CONFIG_CHANGE',
      severity: 'MEDIUM',
      status: 'NEW',
      title: 'Thay đổi dung lượng RAM trên IT-PC-2026-0001 (TMTDM-IT-001)',
      message: 'Phát hiện tổng dung lượng RAM thay đổi từ 8 GB lên 16 GB (bổ sung thanh Kingston 8GB tại DIMM2). Baseline chưa được cập nhật, cần IT xác minh.',
      assetId: asset1.id,
      agentId: agent1.id,
      deviceChangeId: changeRam.id,
      component: 'RAM',
      previousValue: '8 GB',
      newValue: '16 GB',
      source: 'WINDOWS_AGENT',
      detectedAt: minsAgo(12),
    },
  });

  await prisma.alertEvent.create({
    data: {
      ruleCode: 'SOFTWARE_CHANGE',
      category: 'SOFTWARE',
      severity: 'INFO',
      status: 'NEW',
      title: 'Cài đặt phần mềm mới trên IT-PC-2026-0001',
      message: 'Phát hiện cài mới ứng dụng Docker Desktop 4.35.1 trên máy TMTDM-IT-001.',
      assetId: asset1.id,
      agentId: agent1.id,
      deviceChangeId: changeSw.id,
      component: 'SOFTWARE',
      previousValue: 'Chưa cài đặt',
      newValue: 'Docker Desktop 4.35.1',
      source: 'WINDOWS_AGENT',
      detectedAt: minsAgo(12),
    },
  });

  // Helper for creating additional full managed assets with agents
  async function createManagedWorkstation(cfg: {
    assetCode: string;
    codeMode?: string;
    name: string;
    typeCode: string;
    status: string;
    serial: string;
    manufacturer: string;
    model: string;
    hostname: string;
    deptCode: string;
    locCode: string;
    assigneeUsername?: string;
    assigneeName?: string;
    price: number;
    purchaseDate: string;
    warrantyEnd: string;
    supplierCode: string;
    agentStatus: string;
    agentVersion: string;
    ip: string;
    mac: string;
    cpu: string;
    cores: number;
    threads: number;
    ramGb: number;
    diskModel: string;
    diskGb: number;
    osName: string;
    osVer: string;
    activation: string;
    partialKey: string;
    lastHeartbeat: Date;
    extraSoftware?: { name: string; pub: string; ver: string; unauthorized?: boolean }[];
  }) {
    const asset = await prisma.asset.create({
      data: {
        assetCode: cfg.assetCode,
        codeMode: cfg.codeMode || 'AUTO',
        name: cfg.name,
        categoryId: cats.COMPUTE,
        assetTypeId: types[cfg.typeCode],
        status: cfg.status,
        serialNumber: cfg.serial,
        qrCodeValue: `ITAM:${cfg.assetCode}`,
        manufacturer: cfg.manufacturer,
        model: cfg.model,
        hostname: cfg.hostname,
        managingDepartmentId: depts.IT,
        usingDepartmentId: depts[cfg.deptCode],
        assignedUserId: cfg.assigneeUsername ? users[cfg.assigneeUsername] : null,
        assignedUserName: cfg.assigneeName || null,
        locationId: locs[cfg.locCode],
        handoverDate: new Date(cfg.purchaseDate),
        handoverBy: 'Trần Minh Đức',
        receivedBy: cfg.assigneeName || 'Kho IT',
        approvedById: users.itadmin,
        approvedAt: new Date(cfg.purchaseDate),
        createdById: users.itadmin,
        officialSpecsJson: JSON.stringify({
          cpu: `${cfg.cpu} (${cfg.cores}C/${cfg.threads}T)`,
          ramTotalGb: cfg.ramGb,
          disks: `${cfg.diskModel} (${cfg.diskGb} GB)`,
          os: `${cfg.osName} ${cfg.osVer} (${cfg.activation})`,
        }),
      },
    });

    await prisma.assetPurchase.create({
      data: {
        assetId: asset.id,
        purchaseDate: new Date(cfg.purchaseDate),
        inUseDate: new Date(cfg.purchaseDate),
        supplierId: sups[cfg.supplierCode],
        contractNumber: `HD-${cfg.purchaseDate.slice(0, 4)}-${cfg.supplierCode}`,
        invoiceNumber: `INV-${cfg.serial.slice(-5)}`,
        purchasePrice: cfg.price,
        fundingSource: 'Ngân sách đầu tư CNTT',
        warrantyStartDate: new Date(cfg.purchaseDate),
        warrantyEndDate: new Date(cfg.warrantyEnd),
      },
    });

    const agent = await prisma.deviceAgent.create({
      data: {
        agentUid: `AGT-${cfg.hostname}`,
        credentialHash: sha256(`token-${cfg.hostname}`),
        status: cfg.agentStatus,
        agentVersion: cfg.agentVersion,
        hostname: cfg.hostname,
        computerName: cfg.hostname,
        smbiosUuid: `UUID-${cfg.serial}`,
        biosSerial: cfg.serial,
        primaryMac: cfg.mac,
        lastIpAddress: cfg.ip,
        manufacturer: cfg.manufacturer,
        model: cfg.model,
        osSummary: `${cfg.osName} ${cfg.osVer}`,
        enrolledAt: new Date(cfg.purchaseDate),
        lastHeartbeatAt: cfg.lastHeartbeat,
        lastSnapshotAt: cfg.lastHeartbeat,
        assetId: asset.id,
      },
    });

    await prisma.assetAgentLink.create({
      data: { assetId: asset.id, agentId: agent.id, linkedAt: new Date(cfg.purchaseDate), reason: 'Liên kết tự động khi duyệt tài sản' },
    });

    const baseSoftware = [
      { displayName: 'Microsoft Office 365 Enterprise', publisher: 'Microsoft Corporation', displayVersion: '16.0.17928', architecture: 'x64', isUnauthorized: false },
      { displayName: 'Google Chrome', publisher: 'Google LLC', displayVersion: '130.0.6723.92', architecture: 'x64', isUnauthorized: false },
      { displayName: 'Kaspersky Endpoint Security', publisher: 'AO Kaspersky Lab', displayVersion: '12.6.0', architecture: 'x64', isUnauthorized: false },
      ...(cfg.extraSoftware || []).map((s) => ({
        displayName: s.name,
        publisher: s.pub,
        displayVersion: s.ver,
        architecture: 'x64',
        isUnauthorized: !!s.unauthorized,
      })),
    ];

    const snap = await prisma.deviceSnapshot.create({
      data: {
        agentId: agent.id,
        source: 'PERIODIC',
        collectedAt: cfg.lastHeartbeat,
        computerName: cfg.hostname,
        hostname: cfg.hostname,
        smbiosUuid: agent.smbiosUuid,
        serialNumber: cfg.serial,
        manufacturer: cfg.manufacturer,
        model: cfg.model,
        mainboardMfg: cfg.manufacturer,
        mainboardProduct: `${cfg.model} System Board`,
        mainboardSerial: `MB-${cfg.serial}`,
        biosMfg: cfg.manufacturer,
        biosVersion: '2.10.1',
        biosReleaseDate: '2025-11-10',
        totalRamGb: cfg.ramGb,
        totalDiskGb: cfg.diskGb,
        processors: { create: [{ name: cfg.cpu, manufacturer: 'Intel/AMD', cores: cfg.cores, logicalProcessors: cfg.threads, maxClockMhz: 4600 }] },
        memoryModules: { create: [{ slot: 'DIMM1', capacityGb: cfg.ramGb, memoryType: 'DDR5', speedMhz: 4800, manufacturer: 'Samsung' }] },
        disks: { create: [{ model: cfg.diskModel, serialNumber: `DSK-${cfg.serial}`, mediaType: 'NVMe SSD', sizeGb: cfg.diskGb, freeGb: Math.round(cfg.diskGb * 0.55) }] },
        networkAdapters: { create: [{ name: 'Ethernet / Wi-Fi 6E Adapter', macAddress: cfg.mac, ipAddress: cfg.ip, speedMbps: 1000, status: 'UP', isVirtual: false }] },
        graphics: { create: [{ name: 'Integrated Graphics', vramMb: 1024 }] },
        operatingSystem: {
          create: {
            productName: cfg.osName,
            edition: cfg.osName.includes('Server') ? 'Standard' : 'Pro',
            version: cfg.osVer,
            buildNumber: cfg.osName.includes('Server') ? '20348.2760' : '22631.4317',
            architecture: '64-bit',
            activationStatus: cfg.activation,
            licenseDescription: 'Volume / OEM License',
            licenseChannel: cfg.osName.includes('Server') ? 'Volume:MAK' : 'OEM',
            partialProductKey: cfg.partialKey,
          },
        },
        software: { create: baseSoftware },
      },
    });

    await prisma.deviceBaseline.create({
      data: {
        assetId: asset.id,
        agentId: agent.id,
        snapshotId: snap.id,
        version: 1,
        isActive: true,
        confirmedById: users.itadmin,
        confirmedAt: new Date(cfg.purchaseDate),
        baselineJson: JSON.stringify({
          cpu: `${cfg.cpu} (${cfg.cores}C/${cfg.threads}T)`,
          totalRamGb: cfg.ramGb,
          memoryModules: [`DIMM1: ${cfg.ramGb} GB DDR5 4800MHz`],
          disks: [`${cfg.diskModel} (${cfg.diskGb} GB)`],
          mainboard: `${cfg.manufacturer} ${cfg.model} System Board`,
          bios: `${cfg.manufacturer} 2.10.1`,
          gpu: ['Integrated Graphics'],
          os: `${cfg.osName} ${cfg.osVer}`,
          activationStatus: cfg.activation,
          software: baseSoftware.map((s) => `${s.displayName}|${s.displayVersion}`),
        }),
      },
    });

    return { asset, agent, snap };
  }

  const w2 = await createManagedWorkstation({
    assetCode: 'IT-LT-2026-0001',
    name: 'Laptop QA Automation - ThinkPad T14 Gen 4',
    typeCode: 'LT',
    status: 'IN_USE',
    serial: 'PF4X9021',
    manufacturer: 'Lenovo',
    model: 'ThinkPad T14 Gen 4',
    hostname: 'QA-LT-001',
    deptCode: 'QA',
    locCode: 'F4-QA',
    assigneeUsername: 'qaviewer',
    assigneeName: 'Phạm Thu Hà',
    price: 31800000,
    purchaseDate: '2025-02-15',
    warrantyEnd: '2028-02-15',
    supplierCode: 'DGW',
    agentStatus: 'ONLINE',
    agentVersion: '1.2.0',
    ip: '192.168.20.14',
    mac: 'A4:FC:77:20:14:01',
    cpu: 'Intel Core i7-1355U',
    cores: 10,
    threads: 12,
    ramGb: 16,
    diskModel: 'WD PC SN740 512GB',
    diskGb: 512,
    osName: 'Windows 11 Pro',
    osVer: '23H2',
    activation: 'ACTIVATED',
    partialKey: '8HVX7',
    lastHeartbeat: minsAgo(3),
    extraSoftware: [
      { name: 'Node.js 22 LTS', pub: 'Node.js Foundation', ver: '22.14.0' },
      { name: 'Postman', pub: 'Postman Inc.', ver: '11.18.0' },
    ],
  });

  const w3 = await createManagedWorkstation({
    assetCode: 'IT-SV-2025-0001',
    name: 'Máy chủ Ứng dụng Nội bộ - PowerEdge R650xs',
    typeCode: 'SV',
    status: 'IN_USE',
    serial: 'SRV-PE650-8821',
    manufacturer: 'Dell Inc.',
    model: 'PowerEdge R650xs',
    hostname: 'SRV-APP-01',
    deptCode: 'IT',
    locCode: 'F3-IT',
    assigneeUsername: 'sysadmin',
    assigneeName: 'Nguyễn Quản Trị',
    price: 148000000,
    purchaseDate: '2024-01-10',
    warrantyEnd: '2026-12-25', // Expiring soon!
    supplierCode: 'CMC-TS',
    agentStatus: 'ONLINE',
    agentVersion: '1.2.0',
    ip: '192.168.10.5',
    mac: 'EC:2A:72:00:05:11',
    cpu: 'Intel Xeon Silver 4314',
    cores: 16,
    threads: 32,
    ramGb: 64,
    diskModel: 'Dell PERC RAID10 NVMe 1920GB',
    diskGb: 1920,
    osName: 'Windows Server 2022 Standard',
    osVer: '21H2',
    activation: 'ACTIVATED',
    partialKey: 'WX269',
    lastHeartbeat: minsAgo(1),
    extraSoftware: [{ name: 'SQL Server 2022 Standard', pub: 'Microsoft Corporation', ver: '16.0.4150' }],
  });

  const w4 = await createManagedWorkstation({
    assetCode: 'KT-PC-2023-018', // Demonstrates Manual Custom Asset Code preserved verbatim (SRS 7.3 B)!
    codeMode: 'MANUAL',
    name: 'Máy tính Kế toán trưởng - HP ProDesk 400 G9',
    typeCode: 'PC',
    status: 'IN_USE',
    serial: 'HP-400G9-3319',
    manufacturer: 'HP Inc.',
    model: 'HP ProDesk 400 G9 SFF',
    hostname: 'FIN-PC-018',
    deptCode: 'FIN',
    locCode: 'F2-FIN',
    assigneeUsername: 'finuser',
    assigneeName: 'Hoàng Ngọc Lan',
    price: 17900000,
    purchaseDate: '2023-08-10',
    warrantyEnd: '2026-08-10', // Already expired!
    supplierCode: 'FPT-SYN',
    agentStatus: 'OFFLINE',
    agentVersion: '1.0.0', // Outdated agent!
    ip: '192.168.30.18',
    mac: 'C8:5A:CF:30:18:90',
    cpu: 'Intel Core i5-12500',
    cores: 6,
    threads: 12,
    ramGb: 16,
    diskModel: 'Kioxia NVMe 512GB',
    diskGb: 512,
    osName: 'Windows 11 Pro',
    osVer: '22H2',
    activation: 'ACTIVATED',
    partialKey: 'C4M9W',
    lastHeartbeat: hoursAgo(28),
    extraSoftware: [{ name: 'MISA AMIS Kế toán', pub: 'MISA JSC', ver: '2026.2' }],
  });

  const w5 = await createManagedWorkstation({
    assetCode: 'IT-LT-2025-0008',
    name: 'Laptop Kinh doanh - Dell Latitude 5440',
    typeCode: 'LT',
    status: 'IN_USE',
    serial: 'DL-LAT5440-7741',
    manufacturer: 'Dell Inc.',
    model: 'Latitude 5440',
    hostname: 'BIZ-LT-045',
    deptCode: 'BIZ',
    locCode: 'F5-BIZ',
    assigneeUsername: 'bizuser',
    assigneeName: 'Đặng Quốc Bảo',
    price: 26500000,
    purchaseDate: '2025-05-12',
    warrantyEnd: '2028-05-12',
    supplierCode: 'DGW',
    agentStatus: 'ONLINE',
    agentVersion: '1.1.0',
    ip: '10.20.5.45',
    mac: '98:E7:43:05:45:AA',
    cpu: 'Intel Core i5-1345U',
    cores: 10,
    threads: 12,
    ramGb: 16,
    diskModel: 'SK Hynix BC901 512GB',
    diskGb: 512,
    osName: 'Windows 11 Pro',
    osVer: '23H2',
    activation: 'NOT_ACTIVATED', // License warning!
    partialKey: '9T4K2',
    lastHeartbeat: minsAgo(4),
    extraSoftware: [
      { name: 'AnyDesk', pub: 'AnyDesk Software GmbH', ver: '8.0.10', unauthorized: true },
    ],
  });

  const w6 = await createManagedWorkstation({
    assetCode: 'IT-PC-2026-0002',
    name: 'Máy tính Hành chính Nhân sự - Lenovo ThinkCentre M70q',
    typeCode: 'PC',
    status: 'MAINTENANCE',
    serial: 'LN-M70Q-55402',
    manufacturer: 'Lenovo',
    model: 'ThinkCentre M70q Gen 4',
    hostname: 'HR-PC-004',
    deptCode: 'HR',
    locCode: 'F2-HR',
    assigneeUsername: 'hruser',
    assigneeName: 'Vũ Thị Hạnh',
    price: 16200000,
    purchaseDate: '2026-03-01',
    warrantyEnd: '2029-03-01',
    supplierCode: 'HACOM',
    agentStatus: 'OFFLINE',
    agentVersion: '1.2.0',
    ip: '192.168.40.12',
    mac: '54:E1:AD:40:12:BB',
    cpu: 'Intel Core i5-13400T',
    cores: 10,
    threads: 16,
    ramGb: 8,
    diskModel: 'Micron 2400 NVMe 512GB',
    diskGb: 512,
    osName: 'Windows 11 Pro',
    osVer: '23H2',
    activation: 'ACTIVATED',
    partialKey: 'Q7P2R',
    lastHeartbeat: hoursAgo(48),
  });

  // Non-agent assets (Monitors, Printers, Switches, Unallocated Laptop)
  const assetMon = await prisma.asset.create({
    data: {
      assetCode: 'IT-MN-2026-0001',
      name: 'Màn hình Dell UltraSharp U2723QE 27" 4K',
      categoryId: cats.PERIPHERAL,
      assetTypeId: types.MN,
      status: 'IN_USE',
      serialNumber: 'CN-0U2723-8812',
      qrCodeValue: 'ITAM:IT-MN-2026-0001',
      manufacturer: 'Dell Inc.',
      model: 'UltraSharp U2723QE',
      managingDepartmentId: depts.IT,
      usingDepartmentId: depts.QA,
      assignedUserId: users.qaviewer,
      assignedUserName: 'Phạm Thu Hà',
      locationId: locs['F4-QA'],
      handoverDate: new Date('2026-01-20'),
      approvedById: users.itadmin,
      approvedAt: new Date('2026-01-20'),
    },
  });
  await prisma.assetPurchase.create({
    data: {
      assetId: assetMon.id,
      purchaseDate: new Date('2026-01-15'),
      supplierId: sups.HACOM,
      purchasePrice: 13900000,
      warrantyStartDate: new Date('2026-01-15'),
      warrantyEndDate: new Date('2029-01-15'),
    },
  });

  const assetPr = await prisma.asset.create({
    data: {
      assetCode: 'IT-PR-2025-0001',
      name: 'Máy in mạng đa năng HP LaserJet Pro MFP 4103fdw',
      categoryId: cats.PERIPHERAL,
      assetTypeId: types.PR,
      status: 'IN_USE',
      serialNumber: 'VNB3R44102',
      qrCodeValue: 'ITAM:IT-PR-2025-0001',
      manufacturer: 'HP Inc.',
      model: 'LaserJet Pro MFP 4103fdw',
      managingDepartmentId: depts.IT,
      usingDepartmentId: depts.FIN,
      locationId: locs['F2-FIN'],
      handoverDate: new Date('2025-06-10'),
      approvedById: users.itadmin,
      approvedAt: new Date('2025-06-10'),
    },
  });
  await prisma.assetPurchase.create({
    data: {
      assetId: assetPr.id,
      purchaseDate: new Date('2025-06-05'),
      supplierId: sups['FPT-SYN'],
      purchasePrice: 12400000,
      warrantyStartDate: new Date('2025-06-05'),
      warrantyEndDate: new Date('2026-12-05'), // Expiring soon!
    },
  });

  const assetSw = await prisma.asset.create({
    data: {
      assetCode: 'IT-NW-2024-0001',
      name: 'Core Switch Cisco Catalyst 9200L-24P-4G',
      categoryId: cats.NETWORK,
      assetTypeId: types.NW,
      status: 'IN_USE',
      serialNumber: 'JAE27410K9L',
      qrCodeValue: 'ITAM:IT-NW-2024-0001',
      manufacturer: 'Cisco Systems',
      model: 'Catalyst 9200L-24P-4G',
      managingDepartmentId: depts.IT,
      usingDepartmentId: depts.IT,
      locationId: locs['F3-IT'],
      handoverDate: new Date('2024-04-01'),
      approvedById: users.sysadmin,
      approvedAt: new Date('2024-04-01'),
    },
  });
  await prisma.assetPurchase.create({
    data: {
      assetId: assetSw.id,
      purchaseDate: new Date('2024-03-20'),
      supplierId: sups['CMC-TS'],
      purchasePrice: 68500000,
      warrantyStartDate: new Date('2024-03-20'),
      warrantyEndDate: new Date('2027-03-20'),
    },
  });

  const assetSpare = await prisma.asset.create({
    data: {
      assetCode: 'IT-LT-2026-0002',
      name: 'Laptop dự phòng - ThinkPad X1 Carbon Gen 12',
      categoryId: cats.COMPUTE,
      assetTypeId: types.LT,
      status: 'UNALLOCATED',
      serialNumber: 'PF5X120088',
      qrCodeValue: 'ITAM:IT-LT-2026-0002',
      manufacturer: 'Lenovo',
      model: 'ThinkPad X1 Carbon Gen 12',
      managingDepartmentId: depts.IT,
      locationId: locs['WAREHOUSE'],
      locationDetail: 'Tủ số 2 - Kệ B',
      approvedById: users.sysadmin,
      approvedAt: new Date('2026-11-05'),
      notes: 'Hàng mới nhập kho, chờ cấp phát cho nhân sự mới',
    },
  });
  await prisma.assetPurchase.create({
    data: {
      assetId: assetSpare.id,
      purchaseDate: new Date('2026-11-01'),
      supplierId: sups.DGW,
      purchasePrice: 44900000,
      warrantyStartDate: new Date('2026-11-01'),
      warrantyEndDate: new Date('2029-11-01'),
    },
  });

  // Update auto-code sequences so next generated code continues smoothly
  await prisma.assetCodeSequence.upsert({ where: { prefixKey: 'IT-PC-2026' }, update: { lastNumber: 2 }, create: { prefixKey: 'IT-PC-2026', lastNumber: 2 } });
  await prisma.assetCodeSequence.upsert({ where: { prefixKey: 'IT-LT-2026' }, update: { lastNumber: 2 }, create: { prefixKey: 'IT-LT-2026', lastNumber: 2 } });
  await prisma.assetCodeSequence.upsert({ where: { prefixKey: 'IT-MN-2026' }, update: { lastNumber: 1 }, create: { prefixKey: 'IT-MN-2026', lastNumber: 1 } });

  // 11. Pending Discovered Devices (Unapproved Agent + LAN-only device without Agent + Conflict device)
  const pendingAgent = await prisma.deviceAgent.create({
    data: {
      agentUid: 'AGT-QA-PC-009',
      credentialHash: sha256('token-pending-qa009'),
      status: 'ONLINE',
      agentVersion: '1.2.0',
      hostname: 'QA-PC-009',
      computerName: 'QA-PC-009',
      smbiosUuid: '99887766-1122-3344-5566-AABBCCDDEE09',
      biosSerial: 'DL-VOST3910-009',
      primaryMac: 'B0:7B:25:20:09:F1',
      lastIpAddress: '192.168.20.49',
      manufacturer: 'Dell Inc.',
      model: 'Vostro 3910 MT',
      osSummary: 'Windows 11 Pro 24H2',
      enrolledAt: hoursAgo(3),
      lastHeartbeatAt: minsAgo(2),
      lastSnapshotAt: hoursAgo(3),
      assetId: null, // NOT YET APPROVED!
    },
  });

  await prisma.deviceSnapshot.create({
    data: {
      agentId: pendingAgent.id,
      source: 'INITIAL',
      collectedAt: hoursAgo(3),
      computerName: 'QA-PC-009',
      hostname: 'QA-PC-009',
      smbiosUuid: pendingAgent.smbiosUuid,
      serialNumber: 'DL-VOST3910-009',
      manufacturer: 'Dell Inc.',
      model: 'Vostro 3910 MT',
      mainboardMfg: 'Dell Inc.',
      mainboardProduct: '0D42V1',
      biosMfg: 'Dell Inc.',
      biosVersion: '1.19.0',
      totalRamGb: 16,
      totalDiskGb: 512,
      processors: { create: [{ name: 'Intel(R) Core(TM) i5-13400', manufacturer: 'GenuineIntel', cores: 10, logicalProcessors: 16, maxClockMhz: 4600 }] },
      memoryModules: { create: [{ slot: 'DIMM1', capacityGb: 16, memoryType: 'DDR4', speedMhz: 3200, manufacturer: 'Crucial' }] },
      disks: { create: [{ model: 'Kioxia BG5 NVMe 512GB', serialNumber: 'KIO-512-009', mediaType: 'NVMe SSD', sizeGb: 512, freeGb: 412 }] },
      networkAdapters: { create: [{ name: 'Realtek PCIe GbE Family Controller', macAddress: 'B0:7B:25:20:09:F1', ipAddress: '192.168.20.49', speedMbps: 1000, status: 'UP', isVirtual: false }] },
      graphics: { create: [{ name: 'Intel UHD Graphics 730', vramMb: 1024 }] },
      operatingSystem: {
        create: {
          productName: 'Windows 11 Pro',
          edition: 'Professional',
          version: '24H2',
          buildNumber: '26100.2033',
          architecture: '64-bit',
          activationStatus: 'ACTIVATED',
          licenseChannel: 'OEM',
          partialProductKey: 'M4K8P',
        },
      },
      software: {
        create: [
          { displayName: 'Google Chrome', publisher: 'Google LLC', displayVersion: '130.0.6723.92', architecture: 'x64' },
          { displayName: 'Visual Studio Code', publisher: 'Microsoft Corporation', displayVersion: '1.95.0', architecture: 'x64' },
        ],
      },
    },
  });

  await prisma.discoveredDevice.createMany({
    data: [
      {
        source: 'AGENT',
        approvalStatus: 'PENDING',
        agentId: pendingAgent.id,
        hostname: 'QA-PC-009',
        ipAddress: '192.168.20.49',
        macAddress: 'B0:7B:25:20:09:F1',
        macVendor: 'Dell Inc.',
        smbiosUuid: pendingAgent.smbiosUuid,
        serialNumber: 'DL-VOST3910-009',
        manufacturer: 'Dell Inc.',
        model: 'Vostro 3910 MT',
        osName: 'Windows 11 Pro 24H2',
        cpuSummary: 'Intel Core i5-13400 (10C/16T)',
        ramTotalGb: 16,
        diskSummary: 'Kioxia BG5 NVMe 512GB',
        firstSeenAt: hoursAgo(3),
        lastSeenAt: minsAgo(2),
      },
      {
        source: 'LAN_DISCOVERY',
        approvalStatus: 'PENDING',
        hostname: 'DESKTOP-UNMANAGED-88',
        ipAddress: '192.168.20.112',
        macAddress: '00:1A:2B:99:44:88',
        macVendor: 'ASUSTek Computer Inc.',
        openPorts: '135, 445, 3389',
        firstSeenAt: hoursAgo(5),
        lastSeenAt: minsAgo(30),
      },
      {
        source: 'LAN_DISCOVERY',
        approvalStatus: 'IGNORED',
        hostname: 'GUEST-IPHONE-15',
        ipAddress: '192.168.99.24',
        macAddress: 'F2:88:11:AB:CD:01',
        macVendor: 'Apple, Inc.',
        ignoreReason: 'Thiết bị cá nhân khách đến làm việc trên VLAN Guest',
        reviewedBy: 'Trần Minh Đức',
        reviewedAt: hoursAgo(12),
        firstSeenAt: hoursAgo(14),
        lastSeenAt: hoursAgo(13),
      },
    ],
  });

  // 12. Scan Networks & Scan History
  const net1 = await prisma.scanNetwork.create({
    data: { name: 'VLAN 10 - Hạ tầng & IT', cidr: '192.168.10.0/24', vlan: 'VLAN 10', description: 'Dải mạng máy chủ và phòng CNTT' },
  });
  const net2 = await prisma.scanNetwork.create({
    data: { name: 'VLAN 20 - Văn phòng QA & Dev', cidr: '192.168.20.0/24', vlan: 'VLAN 20', description: 'Dải mạng tầng 4 QA Lab' },
  });
  await prisma.scanNetwork.create({
    data: { name: 'VLAN 30 - Kế toán & Hành chính', cidr: '192.168.30.0/24', vlan: 'VLAN 30', description: 'Dải mạng tầng 2 văn phòng' },
  });

  await prisma.scanSchedule.create({
    data: { networkId: net2.id, name: 'Quét định kỳ 02:00 sáng hàng ngày', cronExpr: '0 2 * * *', isEnabled: true, lastRunAt: hoursAgo(5) },
  });

  await prisma.deviceScan.createMany({
    data: [
      { networkId: net1.id, triggerType: 'SCHEDULED', triggeredBy: 'Hệ thống lập lịch', status: 'COMPLETED', hostsScanned: 254, hostsAlive: 18, newDevicesFound: 0, startedAt: hoursAgo(6), completedAt: hoursAgo(6) },
      { networkId: net2.id, triggerType: 'MANUAL', triggeredBy: 'Trần Minh Đức', status: 'COMPLETED', hostsScanned: 254, hostsAlive: 24, newDevicesFound: 2, startedAt: hoursAgo(5), completedAt: hoursAgo(5) },
    ],
  });

  // 13. Additional Alerts (Agent Offline, Warranty Expiring, Unauthorized Software, Windows Not Activated)
  await prisma.alertEvent.createMany({
    data: [
      {
        ruleCode: 'AGENT_OFFLINE',
        category: 'AGENT_OFFLINE',
        severity: 'MEDIUM',
        status: 'ACKNOWLEDGED',
        title: 'Agent offline quá 24 giờ trên KT-PC-2023-018 (FIN-PC-018)',
        message: 'Windows Agent (v1.0.0) không gửi Heartbeat từ 28 giờ trước. Đồng thời phiên bản Agent đang cũ so với bản mới nhất 1.2.0.',
        assetId: w4.asset.id,
        agentId: w4.agent.id,
        source: 'HEARTBEAT_MONITOR',
        detectedAt: hoursAgo(26),
      },
      {
        ruleCode: 'SOFTWARE_UNAUTHORIZED',
        category: 'SOFTWARE',
        severity: 'HIGH',
        status: 'NEW',
        title: 'Phát hiện phần mềm điều khiển từ xa chưa phê duyệt (AnyDesk)',
        message: 'Thiết bị BIZ-LT-045 (IT-LT-2025-0008) đang cài đặt AnyDesk 8.0.10 thuộc danh mục phần mềm cần kiểm tra an toàn thông tin.',
        assetId: w5.asset.id,
        agentId: w5.agent.id,
        component: 'SOFTWARE',
        newValue: 'AnyDesk 8.0.10',
        source: 'POLICY_ENGINE',
        detectedAt: hoursAgo(4),
      },
      {
        ruleCode: 'WINDOWS_ACTIVATION_CHANGE',
        category: 'CONFIG_CHANGE',
        severity: 'HIGH',
        status: 'NEW',
        title: 'Windows chưa kích hoạt trên IT-LT-2025-0008 (BIZ-LT-045)',
        message: 'Trạng thái kích hoạt Windows 11 Pro đang là NOT_ACTIVATED. Cần kiểm tra chứng từ bản quyền OEM/Volume.',
        assetId: w5.asset.id,
        agentId: w5.agent.id,
        component: 'WINDOWS',
        previousValue: 'ACTIVATED',
        newValue: 'NOT_ACTIVATED',
        source: 'WINDOWS_AGENT',
        detectedAt: hoursAgo(4),
      },
      {
        ruleCode: 'WARRANTY_EXPIRING',
        category: 'WARRANTY',
        severity: 'MEDIUM',
        status: 'NEW',
        title: 'Máy chủ IT-SV-2025-0001 sắp hết hạn bảo hành (25/12/2026)',
        message: 'Dell PowerEdge R650xs còn 36 ngày bảo hành từ CMC TS. Cần lập kế hoạch gia hạn gói bảo hành máy chủ.',
        assetId: w3.asset.id,
        source: 'WARRANTY_SCHEDULER',
        detectedAt: hoursAgo(10),
      },
      {
        ruleCode: 'DEVICE_NEW_DISCOVERED',
        category: 'DISCOVERY',
        severity: 'INFO',
        status: 'NEW',
        title: 'Thiết bị mới QA-PC-009 đã đăng ký Agent, chờ duyệt tài sản',
        message: 'Agent AGT-QA-PC-009 (Dell Vostro 3910 MT, IP 192.168.20.49) đã gửi inventory ban đầu và đang nằm trong hàng đợi kiểm duyệt.',
        agentId: pendingAgent.id,
        source: 'AGENT_ENROLLMENT',
        detectedAt: hoursAgo(3),
      },
    ],
  });

  // 14. Assignments, Transfers, Maintenance, Inventory Session
  await prisma.assetAssignment.createMany({
    data: [
      { assetId: asset1.id, assignmentCode: 'BG-2026-0001', departmentId: depts.IT, assigneeName: 'Trần Minh Đức', assigneeUserId: users.itadmin, handoverBy: 'Nguyễn Quản Trị', receivedBy: 'Trần Minh Đức', locationDetail: 'Tầng 3 - Bàn kỹ thuật số 01', handoverDate: new Date('2026-10-01'), status: 'ACTIVE' },
      { assetId: w2.asset.id, assignmentCode: 'BG-2025-0014', departmentId: depts.QA, assigneeName: 'Phạm Thu Hà', assigneeUserId: users.qaviewer, handoverBy: 'Trần Minh Đức', receivedBy: 'Phạm Thu Hà', locationDetail: 'Tầng 4 - Khu QA Lab', handoverDate: new Date('2025-02-15'), status: 'ACTIVE' },
    ],
  });

  await prisma.assetTransfer.create({
    data: {
      transferCode: 'DC-2026-0001',
      assetId: assetMon.id,
      fromDepartmentId: depts.IT,
      fromUserName: 'Kho thiết bị CNTT',
      fromLocation: 'Kho thiết bị CNTT - Tầng 1',
      toDepartmentId: depts.QA,
      toUserName: 'Phạm Thu Hà',
      toLocation: 'Tầng 4 - Khu vực QA Lab',
      reason: 'Trang bị màn hình 4K phục vụ kiểm thử giao diện UI',
      handoverBy: 'Lê Văn Hùng',
      receivedBy: 'Phạm Thu Hà',
      transferDate: new Date('2026-01-20'),
      status: 'COMPLETED',
      createdById: users.itadmin,
    },
  });

  await prisma.assetMaintenance.createMany({
    data: [
      {
        ticketCode: 'BT-2026-0001',
        assetId: w6.asset.id,
        maintenanceType: 'REPAIR',
        issueSummary: 'Lỗi nguồn và quạt tản nhiệt kêu to khi tải cao',
        conditionBefore: 'Máy tự tắt đột ngột sau 20 phút sử dụng',
        receivedDate: new Date('2026-11-14'),
        vendorName: 'Trung tâm Bảo hành Lenovo Việt Nam',
        workPerformed: 'Đang kiểm tra bộ nguồn adapter 90W và thay cụm quạt CPU',
        replacedParts: 'Quạt tản nhiệt ThinkCentre M70q (dự kiến)',
        cost: 1250000,
        performedBy: 'Lê Văn Hùng',
        status: 'IN_PROGRESS',
        createdById: users.itstaff,
      },
      {
        ticketCode: 'BT-2026-0002',
        assetId: w4.asset.id,
        maintenanceType: 'PREVENTIVE',
        issueSummary: 'Vệ sinh định kỳ, tra keo tản nhiệt và kiểm tra ổ cứng',
        conditionBefore: 'Hoạt động bình thường, nhiệt độ CPU cao',
        receivedDate: new Date('2026-07-10'),
        completedDate: new Date('2026-07-11'),
        vendorName: 'Nội bộ Phòng CNTT',
        workPerformed: 'Vệ sinh bụi, thay keo MX-4, cập nhật BIOS',
        cost: 0,
        performedBy: 'Lê Văn Hùng',
        status: 'COMPLETED',
        createdById: users.itstaff,
      },
    ],
  });

  const invSession = await prisma.inventorySession.create({
    data: {
      sessionCode: 'KK-2026-Q4',
      name: 'Kiểm kê định kỳ Tài sản CNTT Quý 4/2026',
      status: 'OPEN',
      startDate: new Date('2026-11-10'),
      dueDate: new Date('2026-11-30'),
      createdById: users.itadmin,
      notes: 'Đối chiếu thực tế bằng mã QR và dữ liệu Windows Agent tại toàn bộ các phòng ban',
    },
  });

  await prisma.inventoryItem.createMany({
    data: [
      { sessionId: invSession.id, assetId: asset1.id, status: 'WRONG_CONFIG', actualLocation: 'Tầng 3 - P.301', actualUser: 'Trần Minh Đức', actualCondition: 'Tốt - RAM thực tế 16GB khác Baseline 8GB', discrepancyNotes: 'Cần xác minh nâng cấp RAM', checkedBy: 'Lê Văn Hùng', checkedAt: new Date('2026-11-18') },
      { sessionId: invSession.id, assetId: w2.asset.id, status: 'CHECKED', actualLocation: 'Tầng 4 - QA Lab', actualUser: 'Phạm Thu Hà', actualCondition: 'Hoạt động tốt, nguyên tem QR', checkedBy: 'Lê Văn Hùng', checkedAt: new Date('2026-11-18') },
      { sessionId: invSession.id, assetId: w3.asset.id, status: 'CHECKED', actualLocation: 'Tầng 3 - Rack 01', actualUser: 'Nguyễn Quản Trị', actualCondition: 'Hoạt động ổn định 24/7', checkedBy: 'Trần Minh Đức', checkedAt: new Date('2026-11-17') },
      { sessionId: invSession.id, assetId: w4.asset.id, status: 'NOT_CHECKED' },
      { sessionId: invSession.id, assetId: w6.asset.id, status: 'DAMAGED', actualLocation: 'Đang gửi TTBH Lenovo', actualUser: 'Vũ Thị Hạnh', actualCondition: 'Đang sửa chữa theo phiếu BT-2026-0001', checkedBy: 'Lê Văn Hùng', checkedAt: new Date('2026-11-18') },
      { sessionId: invSession.id, assetId: assetMon.id, status: 'CHECKED', actualLocation: 'Tầng 4 - QA Lab', actualUser: 'Phạm Thu Hà', actualCondition: 'Tốt', checkedBy: 'Lê Văn Hùng', checkedAt: new Date('2026-11-18') },
      { sessionId: invSession.id, assetId: assetPr.id, status: 'NOT_CHECKED' },
      { sessionId: invSession.id, assetId: assetSw.id, status: 'CHECKED', actualLocation: 'Tầng 3 - Rack Core', actualUser: 'Phòng CNTT', actualCondition: 'Tốt', checkedBy: 'Trần Minh Đức', checkedAt: new Date('2026-11-17') },
      { sessionId: invSession.id, assetId: assetSpare.id, status: 'CHECKED', actualLocation: 'Kho IT - Tủ 2', actualUser: 'Chưa cấp phát', actualCondition: 'Mới 100%', checkedBy: 'Lê Văn Hùng', checkedAt: new Date('2026-11-18') },
    ],
  });

  // 15. Sample Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { userId: users.sysadmin, actorName: 'Nguyễn Quản Trị', action: 'ASSET_APPROVED', entityType: 'Asset', entityId: asset1.id, newValue: 'IT-PC-2026-0001 (TMTDM-IT-001)', reason: 'Duyệt tài sản từ Agent AGT-TMTDM-IT-001', ipAddress: '192.168.10.10' },
      { userId: users.itadmin, actorName: 'Trần Minh Đức', action: 'ASSET_CREATED_MANUAL_CODE', entityType: 'Asset', entityId: w4.asset.id, newValue: 'KT-PC-2023-018', reason: 'Chuyển đổi mã tài sản cũ của Phòng Kế toán', ipAddress: '192.168.10.21' },
      { userId: users.itadmin, actorName: 'Trần Minh Đức', action: 'ASSET_TRANSFERRED', entityType: 'Asset', entityId: assetMon.id, oldValue: 'Kho IT', newValue: 'Phòng QA - Phạm Thu Hà', reason: 'Trang bị màn hình 4K cho nhóm QA', ipAddress: '192.168.10.21' },
      { userId: users.sysadmin, actorName: 'Nguyễn Quản Trị', action: 'ENROLLMENT_TOKEN_CREATED', entityType: 'EnrollmentToken', newValue: 'Token triển khai GPO Q4/2026', ipAddress: '192.168.10.10' },
    ],
  });

  await prisma.assetAuditLog.createMany({
    data: [
      { assetId: asset1.id, action: 'APPROVED', newValue: 'IT-PC-2026-0001', reason: 'Duyệt ghi nhận tài sản chính thức và chốt Baseline v1', actorId: users.sysadmin, actorName: 'Nguyễn Quản Trị', ipAddress: '192.168.10.10' },
      { assetId: assetMon.id, action: 'TRANSFERRED', fieldName: 'usingDepartment', oldValue: 'Phòng CNTT (Kho)', newValue: 'Phòng QA (Phạm Thu Hà)', reason: 'Trang bị màn hình 4K phục vụ kiểm thử UI', actorId: users.itadmin, actorName: 'Trần Minh Đức', ipAddress: '192.168.10.21' },
    ],
  });

  console.log('Seed completed successfully! Default login accounts (password: Admin@123):');
  console.log(' - sysadmin (System Admin)');
  console.log(' - itadmin  (IT Admin)');
  console.log(' - itstaff  (IT Staff)');
  console.log(' - qaviewer (Department Viewer - QA)');
  console.log(` - Enrollment Token for Agent testing: ${rawEnrollToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
