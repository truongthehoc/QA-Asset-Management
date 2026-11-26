// Validated CVD-safe categorical palette (checked via dataviz/scripts/validate_palette.js)
export const CHART_COLORS = ['#1D4ED8', '#D97706', '#0D9488', '#E11D48', '#7C3AED', '#059669'];

export function formatVnd(amount?: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('vi-VN');
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
