// Validated CVD-safe categorical palette (checked via dataviz/scripts/validate_palette.js)
export const CHART_COLORS = ['#1D4ED8', '#D97706', '#0D9488', '#E11D48', '#7C3AED', '#059669'];

export function formatVnd(amount?: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date?: string | Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date?: string | Date | null): string {
  if (!date) return 'Chưa có';
  const diffMin = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} ngày trước`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export const ASSET_STATUS_META: Record<string, { label: string; cls: string }> = {
  IN_USE: { label: 'Đang sử dụng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UNALLOCATED: { label: 'Chưa phân bổ', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  MAINTENANCE: { label: 'Đang sửa chữa', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  BROKEN: { label: 'Hư hỏng', cls: 'bg-red-50 text-red-700 border-red-200' },
  DISPOSED: { label: 'Đã thanh lý', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  LOST: { label: 'Thất lạc', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  INFO: { label: 'Thông tin', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  MEDIUM: { label: 'Trung bình', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  HIGH: { label: 'Cao', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  CRITICAL: { label: 'Nghiêm trọng', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Tạo mới tài sản',
  UPDATED: 'Cập nhật thông tin',
  CODE_CHANGED: 'Điều chỉnh mã tài sản',
  APPROVED: 'Phê duyệt thiết bị thành tài sản',
  HANDOVER: 'Cấp phát / Bàn giao tài sản',
  TRANSFERRED: 'Điều chuyển tài sản',
  RETURNED_TO_STOCK: 'Thu hồi về kho',
  DOCUMENT_UPLOADED: 'Tải lên hồ sơ đính kèm',
  DOCUMENT_DELETED: 'Xóa hồ sơ đính kèm',
  BASELINE_CONFIRMED: 'Xác nhận Baseline cấu hình',
  CHANGE_APPROVED: 'Phê duyệt thay đổi cấu hình',
  CHANGE_REJECTED: 'Từ chối thay đổi cấu hình',
  MAINTENANCE: 'Bảo trì / Sửa chữa',
  MAINTENANCE_CREATED: 'Tạo phiếu bảo trì / sửa chữa',
  MAINTENANCE_UPDATED: 'Cập nhật phiếu bảo trì',
  MAINTENANCE_COMPLETED: 'Hoàn tất bảo trì / sửa chữa',
  DISPOSED: 'Thanh lý tài sản',
  INVENTORY_CHECKED: 'Xác nhận kiểm kê',
  USER_LOGIN: 'Đăng nhập hệ thống',
  USER_CREATED: 'Tạo tài khoản người dùng',
  USER_UPDATED: 'Cập nhật tài khoản người dùng',
  USER_ACTIVATED: 'Kích hoạt tài khoản',
  USER_DISABLED: 'Ngưng hoạt động tài khoản',
  ROLE_CREATED: 'Tạo nhóm quyền',
  ROLE_UPDATED: 'Cập nhật nhóm quyền',
  ROLE_DELETED: 'Xóa nhóm quyền',
  EMPLOYEE_CREATED: 'Thêm nhân viên',
  EMPLOYEE_UPDATED: 'Cập nhật nhân viên',
  EMPLOYEE_ACTIVATED: 'Kích hoạt nhân viên',
  EMPLOYEE_DEACTIVATED: 'Ngưng hoạt động nhân viên',
  EMPLOYEE_DELETED: 'Xóa nhân viên',
  ASSET_CATEGORY_CREATED: 'Thêm nhóm tài sản',
  ASSET_CATEGORY_UPDATED: 'Cập nhật nhóm tài sản',
  ASSET_CATEGORY_DELETED: 'Xóa nhóm tài sản',
  ASSET_STATUS_CREATED: 'Thêm trạng thái tài sản',
  ASSET_STATUS_UPDATED: 'Cập nhật trạng thái tài sản',
  ASSET_STATUS_ACTIVATED: 'Kích hoạt trạng thái tài sản',
  ASSET_STATUS_DEACTIVATED: 'Ngưng sử dụng trạng thái tài sản',
  ASSET_STATUS_DELETED: 'Xóa trạng thái tài sản',
  SYSTEM_SETTING_UPDATED: 'Cập nhật cấu hình hệ thống',
  ENROLLMENT_TOKEN_CREATED: 'Tạo Enrollment Token',
  ENROLLMENT_TOKEN_REVOKED: 'Thu hồi Enrollment Token',
  AGENT_ENROLLED: 'Đăng ký Windows Agent',
  AGENT_REVOKED: 'Thu hồi Windows Agent',
};

export function formatAuditAction(action?: string | null): string {
  if (!action) return '—';
  return AUDIT_ACTION_LABELS[action] || action;
}

export const ALERT_STATUS_META: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'Mới', cls: 'bg-red-50 text-red-700 border-red-200' },
  ACKNOWLEDGED: { label: 'Đã tiếp nhận', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  CONFIRMED: { label: 'Đã xác nhận', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Đã đóng', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  IGNORED: { label: 'Bỏ qua', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const INVENTORY_STATUS_META: Record<string, { label: string; cls: string }> = {
  CHECKED: { label: 'Đã kiểm kê', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NOT_CHECKED: { label: 'Chưa kiểm kê', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  MISSING: { label: 'Không tìm thấy', cls: 'bg-red-50 text-red-700 border-red-200' },
  WRONG_LOCATION: { label: 'Sai vị trí', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  WRONG_USER: { label: 'Sai người dùng', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  WRONG_CONFIG: { label: 'Sai cấu hình', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  DAMAGED: { label: 'Hư hỏng', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  PR: 'Phiếu yêu cầu mua sắm (PR)',
  PO: 'Đơn đặt hàng (PO)',
  HANDOVER: 'Biên bản bàn giao',
  INVOICE: 'Hóa đơn',
  CONTRACT: 'Hợp đồng',
  PURCHASE_PDF: 'Hồ sơ mua sắm PDF',
  WARRANTY: 'Chứng từ bảo hành',
  PHOTO: 'Hình ảnh thiết bị',
  MAINTENANCE: 'Biên bản sửa chữa',
  OTHER: 'Tài liệu khác',
};

export const MAINTENANCE_STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  OPEN: { label: 'Chờ tiếp nhận', cls: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  IN_PROGRESS: { label: 'Đang sửa chữa', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  WAITING_PARTS: { label: 'Chờ linh kiện', cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  COMPLETED: { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export const MAINTENANCE_TYPE_META: Record<string, { label: string; desc: string; cls: string }> = {
  REPAIR: {
    label: 'Sửa chữa sự cố',
    desc: 'Khắc phục lỗi phần cứng, phần mềm hoặc hỏng hóc thiết bị',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  PREVENTIVE: {
    label: 'Bảo trì định kỳ',
    desc: 'Vệ sinh, kiểm tra hiệu năng, bảo dưỡng theo lịch định kỳ',
    cls: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  UPGRADE: {
    label: 'Nâng cấp phần cứng',
    desc: 'Thay thế hoặc bổ sung RAM, SSD, pin và linh kiện mới',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  WARRANTY_CLAIM: {
    label: 'Gửi bảo hành hãng',
    desc: 'Gửi thiết bị đến trung tâm bảo hành hoặc nhà cung cấp',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

export const DISPOSAL_METHOD_META: Record<string, { label: string; desc: string; cls: string }> = {
  LIQUIDATION: {
    label: 'Thanh lý / Bán đấu giá',
    desc: 'Bán thanh lý thu hồi một phần giá trị tài sản theo quyết định',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  SCRAP: {
    label: 'Hủy bỏ / Phế liệu',
    desc: 'Thiết bị hỏng nặng không thể sửa chữa, tiêu hủy hoặc bán phế liệu',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  DONATION: {
    label: 'Chuyển giao / Tặng cho',
    desc: 'Chuyển giao ra ngoài đơn vị, tài trợ hoặc quyên góp',
    cls: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  RETURN_VENDOR: {
    label: 'Trả lại nhà cung cấp',
    desc: 'Hoàn trả thiết bị thuê, mượn hoặc thu hồi theo cam kết hãng',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export const LICENSE_TYPE_META: Record<string, { label: string; desc: string; cls: string }> = {
  SUBSCRIPTION: {
    label: 'Thuê bao định kỳ',
    desc: 'Gia hạn theo tháng hoặc năm (Microsoft 365, Adobe CC, AutoCAD...)',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  PERPETUAL: {
    label: 'Bản quyền vĩnh viễn',
    desc: 'Mua một lần sử dụng không giới hạn thời gian',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  VOLUME: {
    label: 'Volume / Doanh nghiệp',
    desc: 'Gói bản quyền số lượng lớn (MAK/KMS) cấp cho nhiều máy',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  OEM: {
    label: 'OEM theo máy',
    desc: 'Bản quyền gắn cố định theo phần cứng thiết bị khi mua',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  FLOATING: {
    label: 'Floating / Dùng chung',
    desc: 'Bản quyền cấp phát động theo số người dùng đồng thời',
    cls: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

export const LICENSE_STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Đang hiệu lực', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXPIRING_SOON: { label: 'Sắp hết hạn', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  EXPIRED: { label: 'Đã hết hạn', cls: 'bg-red-50 text-red-700 border-red-200' },
  REVOKED: { label: 'Đã thu hồi', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export const LICENSE_DOC_TYPES: Record<string, string> = {
  CONTRACT: 'Hợp đồng bản quyền',
  INVOICE: 'Hóa đơn mua sắm',
  CERTIFICATE: 'Chứng nhận bản quyền (Certificate)',
  PO: 'Đơn đặt hàng (PO)',
  HANDOVER: 'Biên bản bàn giao',
  OTHER: 'Chứng từ khác',
};
