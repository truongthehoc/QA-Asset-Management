import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Info,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Layers,
  HardDrive,
  ArrowLeftRight,
  KeyRound,
  Wrench,
  QrCode,
  Bell,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import { Badge } from '../components/UiPrimitives';

interface ReleaseNote {
  version: string;
  date: string;
  tag: 'Mới nhất' | 'Cập nhật' | 'Khởi tạo';
  highlights: Array<{ type: 'feature' | 'improve' | 'fix'; text: string }>;
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.12',
    date: '28/11/2026',
    tag: 'Mới nhất',
    highlights: [
      { type: 'feature', text: 'Bổ sung trang Thông tin phần mềm hiển thị phiên bản, nhật ký cập nhật và quy trình hướng dẫn sử dụng.' },
      { type: 'feature', text: 'Thiết kế trang Thông tin tài khoản riêng (/profile) hỗ trợ tải ảnh đại diện tối đa 20MB và cập nhật Email, Số điện thoại.' },
      { type: 'feature', text: 'Thêm chuông thông báo trên Header kèm tự động đánh dấu đã xem và mở đúng cảnh báo chi tiết.' },
      { type: 'improve', text: 'Tối ưu giao diện di động & màn hình nhỏ (KPI 2 cột, thẻ danh sách, dropdown toàn màn hình, Footer cố định kèm đồng hồ thực).' },
    ],
  },
  {
    version: '1.0.5',
    date: '28/11/2026',
    tag: 'Cập nhật',
    highlights: [
      { type: 'feature', text: 'Thiết kế lại Dashboard tổng quan hiện đại với 8 thẻ KPI sparkline, 6 biểu đồ phân tích và Trung tâm cảnh báo.' },
      { type: 'feature', text: 'Xây dựng phân hệ Quản lý Bản quyền Phần mềm (License) trọn vòng đời: ngày mua, kích hoạt, hết hạn, cấp phát, luân chuyển, thu hồi và đính kèm nhiều tệp hợp đồng.' },
      { type: 'feature', text: 'Thêm nhóm tham số Thông tin phần mềm trong Cấu hình hệ thống và cơ chế tự động tăng phiên bản mỗi lần deploy.' },
    ],
  },
  {
    version: '1.0.2',
    date: '28/11/2026',
    tag: 'Cập nhật',
    highlights: [
      { type: 'feature', text: 'Tách riêng trang Lập phiếu bảo trì, Chi tiết phiếu bảo trì (có tiến trình 4 bước + Nhật ký xử lý) và trang Lập biên bản thanh lý tài sản.' },
      { type: 'improve', text: 'Cố định thanh Sidebar khi cuộn trang và chuẩn hóa định dạng ngày dd/mm/yyyy, tiền tệ phân tách dấu chấm.' },
      { type: 'improve', text: 'Đồng bộ logo đơn vị không khung trên Sidebar, Form đăng nhập và Favicon trình duyệt.' },
    ],
  },
  {
    version: '1.0.0',
    date: '27/11/2026',
    tag: 'Khởi tạo',
    highlights: [
      { type: 'feature', text: 'Phát hành hệ thống Quản lý tài sản: danh mục, khám phá thiết bị Windows Agent, bàn giao/điều chuyển/thu hồi kèm in biên bản A4 và tra cứu tem QR công khai.' },
      { type: 'feature', text: 'Quản lý nhân viên, tài khoản, phân quyền RBAC chi tiết, phân trang toàn bộ bảng dữ liệu và nhật ký Audit Log.' },
    ],
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Thiết lập Danh mục & Thông tin đơn vị',
    icon: Layers,
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBg: 'bg-sky-100 text-sky-700',
    to: '/admin/settings',
    linkLabel: 'Mở Cấu hình hệ thống',
    items: [
      'Vào Cấu hình hệ thống cập nhật Tên đơn vị, Địa chỉ, Logo và Thông tin phần mềm.',
      'Khai báo danh mục Phòng ban, Vị trí, Nhân viên, Nhóm tài sản, Loại tài sản (kèm thứ tự hiển thị) và Nhà cung cấp.',
      'Tạo tài khoản người dùng gắn với hồ sơ nhân viên và gán nhóm quyền RBAC phù hợp.',
    ],
  },
  {
    step: '02',
    title: 'Ghi nhận Tài sản mới hoặc Duyệt từ Agent',
    icon: HardDrive,
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-700',
    to: '/assets',
    linkLabel: 'Danh sách tài sản',
    items: [
      'Thêm tài sản thủ công tại Danh sách tài sản → Thêm tài sản (mã tự sinh theo quy tắc).',
      'Hoặc cài đặt Windows Agent trên máy trạm để tự động thu thập cấu hình phần cứng, phần mềm rồi phê duyệt tại Khám phá thiết bị.',
      'Cập nhật thông tin mua sắm, bảo hành và tải lên hồ sơ chứng từ (Hóa đơn, Hợp đồng, PO) ngay trong chi tiết tài sản.',
    ],
  },
  {
    step: '03',
    title: 'Cấp phát, Điều chuyển, Thu hồi & In Biên bản',
    icon: ArrowLeftRight,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-700',
    to: '/transfers/new',
    linkLabel: 'Lập phiếu bàn giao',
    items: [
      'Chọn 1 trong 3 nghiệp vụ: Cấp phát mới (từ kho), Điều chuyển (giữa phòng ban/nhân viên) hoặc Thu hồi về kho.',
      'Hệ thống tự động cập nhật trạng thái tài sản, người sử dụng, phòng ban và ghi nhận Audit Log.',
      'In trực tiếp Biên bản bàn giao / điều chuyển / thu hồi chuẩn khổ A4 đầy đủ chữ ký các bên.',
    ],
  },
  {
    step: '04',
    title: 'Quản lý Bản quyền Phần mềm (License)',
    icon: KeyRound,
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
    iconBg: 'bg-violet-100 text-violet-700',
    to: '/software',
    linkLabel: 'Phần mềm & License',
    items: [
      'Tạo hồ sơ bản quyền với Loại license, Tổng số suất, Ngày mua, Ngày kích hoạt, Ngày hết hạn và Số hợp đồng.',
      'Đính kèm nhiều tệp Hợp đồng / Hóa đơn / Chứng nhận bản quyền bản PDF hoặc ảnh.',
      'Thực hiện Cấp phát, Luân chuyển hoặc Thu hồi từng suất bản quyền cho nhân viên/máy tính; hệ thống tự cảnh báo khi sắp hết hạn (≤ 30 ngày).',
    ],
  },
  {
    step: '05',
    title: 'Bảo trì, Sửa chữa & Thanh lý tài sản',
    icon: Wrench,
    accent: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
    to: '/maintenance',
    linkLabel: 'Bảo trì & Thanh lý',
    items: [
      'Lập phiếu bảo trì/sửa chữa mới: trạng thái tài sản tự động chuyển sang Đang sửa chữa.',
      'Cập nhật tiến độ theo 4 bước (Chờ tiếp nhận → Đang sửa chữa → Chờ linh kiện → Hoàn thành) và ghi nhật ký chi phí, linh kiện thay thế.',
      'Với tài sản hỏng nặng hoặc hết khấu hao, sử dụng trang Lập biên bản thanh lý riêng để ghi nhận quyết định và giá trị thu hồi.',
    ],
  },
  {
    step: '06',
    title: 'In Tem QR & Kiểm kê định kỳ',
    icon: QrCode,
    accent: 'bg-teal-50 text-teal-700 border-teal-200',
    iconBg: 'bg-teal-100 text-teal-700',
    to: '/inventory',
    linkLabel: 'Kiểm kê tài sản',
    items: [
      'In tem mã QR dán lên thiết bị; bất kỳ ai dùng điện thoại quét QR đều xem được thẻ thông tin tài sản nhanh chóng.',
      'Khởi tạo đợt kiểm kê theo toàn công ty hoặc từng phòng ban với hạn hoàn thành (dd/mm/yyyy).',
      'Quét mã QR hoặc nhập mã tài sản để xác nhận khớp sổ sách, ghi nhận sai lệch vị trí/người dùng/hư hỏng và chốt đợt kiểm kê.',
    ],
  },
  {
    step: '07',
    title: 'Theo dõi Cảnh báo & Báo cáo quản trị',
    icon: Bell,
    accent: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-100 text-rose-700',
    to: '/alerts',
    linkLabel: 'Cảnh báo & Thay đổi',
    items: [
      'Kiểm tra biểu tượng chuông thông báo trên Header hoặc Trung tâm cảnh báo trên Dashboard mỗi ngày.',
      'Xác minh các thay đổi cấu hình phần cứng phát hiện từ Windows Agent (phê duyệt cập nhật Baseline hoặc từ chối).',
      'Xuất báo cáo tổng hợp tài sản, khấu hao, bảo trì và kiểm kê tại phân hệ Báo cáo.',
    ],
  },
];

const CHANGE_BADGE: Record<'feature' | 'improve' | 'fix', { label: string; cls: string }> = {
  feature: { label: 'Tính năng mới', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  improve: { label: 'Cải tiến', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  fix: { label: 'Sửa lỗi', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
};

export const SoftwareInfoPage: React.FC = () => {
  const branding = useBranding();
  const [tab, setTab] = useState<'guide' | 'changelog'>('guide');

  return (
    <div className="space-y-5">
      {/* HERO THÔNG TIN PHẦN MỀM */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-14 w-auto max-w-[96px] object-contain shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-rail text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-ink-primary tracking-tight">
                  {branding.appName || 'Quản lý tài sản'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-soft text-brand border border-sky-200 font-mono text-xs font-semibold">
                  <Tag className="w-3 h-3" /> v{branding.version}
                </span>
              </div>
              {branding.name && (
                <p className="text-xs sm:text-sm font-medium text-ink-secondary mt-0.5">{branding.name}</p>
              )}
              <p className="text-xs text-ink-muted mt-1">
                Phát triển bởi <strong className="text-ink-secondary">{branding.developedBy}</strong> • Hệ thống quản trị vòng đời tài sản &amp; bản quyền phần mềm tập trung.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-line text-center">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">Phiên bản</div>
              <div className="font-mono text-sm font-bold text-brand mt-0.5">v{branding.version}</div>
            </div>
            <div className="px-3.5 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-700">Trạng thái</div>
              <div className="text-xs font-semibold text-emerald-700 mt-1 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ổn định
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setTab('guide')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap inline-flex items-center gap-2 ${
            tab === 'guide' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Quy trình hướng dẫn sử dụng ({WORKFLOW_STEPS.length} bước)
        </button>
        <button
          type="button"
          onClick={() => setTab('changelog')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap inline-flex items-center gap-2 ${
            tab === 'changelog' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Nhật ký thay đổi &amp; Cập nhật ({RELEASE_NOTES.length})
        </button>
      </div>

      {/* TAB 1: QUY TRÌNH HƯỚNG DẪN SỬ DỤNG */}
      {tab === 'guide' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {WORKFLOW_STEPS.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.step}
                className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st.iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${st.accent}`}>
                          BƯỚC {st.step}
                        </span>
                        <h2 className="text-sm font-bold text-ink-primary mt-1">{st.title}</h2>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-ink-secondary leading-relaxed">
                    {st.items.map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand/70 shrink-0 mt-1.5" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-end">
                  <Link
                    to={st.to}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    {st.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: NHẬT KÝ THAY ĐỔI & CẬP NHẬT GẦN NHẤT */}
      {tab === 'changelog' && (
        <div className="space-y-4">
          {RELEASE_NOTES.map((rel, idx) => (
            <div
              key={rel.version}
              className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded bg-ink-primary text-white">
                    v{idx === 0 ? branding.version : rel.version}
                  </span>
                  <Badge
                    label={rel.tag}
                    cls={
                      rel.tag === 'Mới nhất'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }
                  />
                </div>
                <span className="text-xs font-mono text-ink-muted">Ngày phát hành: {rel.date}</span>
              </div>

              <ul className="space-y-2">
                {rel.highlights.map((h, i) => {
                  const meta = CHANGE_BADGE[h.type];
                  return (
                    <li key={i} className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2.5 text-xs sm:text-sm">
                      <span className="shrink-0 mt-0.5">
                        <Badge label={meta.label} cls={meta.cls} />
                      </span>
                      <span className="text-ink-primary leading-relaxed">{h.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span>
              Số phiên bản sẽ <strong>tự động tăng sau mỗi lần build / deploy</strong> lên hệ thống. Quản trị viên có thể tùy chỉnh Tên phần mềm và Đơn vị phát triển tại mục{' '}
              <Link to="/admin/settings" className="font-semibold underline">
                Cấu hình hệ thống → Thông tin phần mềm
              </Link>
              .
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
