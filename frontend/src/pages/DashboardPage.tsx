import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor,
  CheckCircle2,
  Package,
  Wrench,
  ShieldCheck,
  Clock,
  XCircle,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Building2,
  Layers,
  CalendarClock,
  AlertTriangle,
  AlertCircle,
  MonitorOff,
  CalendarDays,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import { api } from '../api/client';
import { formatDate, formatRelativeTime } from '../utils/format';

// Validated light-mode palette (dataviz/scripts/validate_palette.js PASS)
const DONUT_PALETTE = ['#3B82F6', '#D946EF', '#10B981', '#F59E0B', '#8B5CF6'];
const STATUS_DONUT_COLORS: Record<string, string> = {
  'Đang sử dụng': '#22C55E',
  'Chưa phân bổ': '#F59E0B',
  'Đang sửa chữa': '#3B82F6',
  'Hư hỏng': '#EF4444',
  'Đã thanh lý': '#94A3B8',
  'Thất lạc': '#E11D48',
};
const LICENSE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22C55E',
  EXPIRING_SOON: '#F59E0B',
  EXPIRED: '#EF4444',
};

const Sparkline: React.FC<{ color: string; variant?: number }> = ({ color, variant = 0 }) => {
  const paths = [
    'M0 24 Q 14 21, 24 17 T 48 14 T 72 9 T 96 4',
    'M0 22 Q 16 18, 28 19 T 54 12 T 76 11 T 96 5',
    'M0 23 Q 15 24, 28 16 T 52 17 T 74 10 T 96 8',
    'M0 21 Q 18 14, 32 18 T 58 13 T 80 7 T 96 9',
  ];
  const d = paths[variant % paths.length];
  const gradId = `spark-${color.replace('#', '')}-${variant}`;
  return (
    <svg viewBox="0 0 96 28" className="w-24 h-7 shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={`${d} L 96 28 L 0 28 Z`} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

interface DonutCardProps {
  title: string;
  icon: React.ReactNode;
  linkTo?: string;
  data: Array<{ name: string; value: number; color: string }>;
  centerValue: number;
  centerLabel: string;
  emptyText?: string;
}

const DonutCard: React.FC<DonutCardProps> = ({
  title,
  icon,
  linkTo,
  data,
  centerValue,
  centerLabel,
  emptyText = 'Chưa có dữ liệu',
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const safeData = total > 0 ? data : [{ name: emptyText, value: 1, color: '#E2E8F0' }];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h2 className="text-sm font-semibold text-ink-primary truncate">{title}</h2>
        </div>
        {linkTo && (
          <Link to={linkTo} className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1 shrink-0">
            Xem chi tiết <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 min-h-[168px]">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={total > 0 ? 2 : 0}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {safeData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              {total > 0 && (
                <Tooltip
                  formatter={(v: any, name: any) => [
                    `${Number(v).toLocaleString('vi-VN')} (${Math.round((Number(v) / total) * 1000) / 10}%)`,
                    name,
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-ink-primary tabular-nums leading-tight">
              {centerValue.toLocaleString('vi-VN')}
            </span>
            <span className="text-[11px] text-ink-muted">{centerLabel}</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5 min-w-0">
          {total === 0 ? (
            <div className="text-xs text-ink-muted text-center sm:text-left">{emptyText}</div>
          ) : (
            data.map((item) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-ink-secondary truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <span className="font-semibold text-ink-primary tabular-nums shrink-0">{pct}%</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alertTab, setAlertTab] = useState<'ALL' | 'ASSET' | 'LICENSE'>('ALL');

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const onRealtime = () => load(true);
    window.addEventListener('itam:realtime-update', onRealtime);
    return () => window.removeEventListener('itam:realtime-update', onRealtime);
  }, []);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const alertCenter: any[] = data?.alertCenter || [];
  const expiringLicenseList: any[] = data?.expiringLicenseList || [];

  const assetAlertCount = useMemo(() => alertCenter.filter((a) => a.scope === 'ASSET').length, [alertCenter]);
  const licenseAlertCount = useMemo(() => alertCenter.filter((a) => a.scope === 'LICENSE').length, [alertCenter]);
  const filteredAlerts = useMemo(() => {
    if (alertTab === 'ALL') return alertCenter;
    return alertCenter.filter((a) => a.scope === alertTab);
  }, [alertCenter, alertTab]);

  if (loading && !data) {
    return <div className="text-sm text-ink-secondary py-12 text-center">Đang tải dữ liệu tổng quan...</div>;
  }

  const pctOf = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%';

  const kpiCards = [
    // Row 1: Tài sản IT
    {
      label: 'Tổng tài sản',
      value: kpis.totalAssets || 0,
      meta: `${kpis.agentsOnline || 0} trực tuyến`,
      metaCls: 'text-emerald-600',
      icon: Monitor,
      iconBg: 'bg-blue-100 text-blue-600',
      sparkColor: '#3B82F6',
      to: '/assets',
    },
    {
      label: 'Đang sử dụng',
      value: kpis.inUse || 0,
      meta: pctOf(kpis.inUse || 0, kpis.totalAssets || 0),
      metaCls: 'text-emerald-600',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 text-emerald-600',
      sparkColor: '#10B981',
      to: '/assets?status=IN_USE',
    },
    {
      label: 'Chưa phân bổ',
      value: kpis.unallocated || 0,
      meta: pctOf(kpis.unallocated || 0, kpis.totalAssets || 0),
      metaCls: 'text-amber-600',
      icon: Package,
      iconBg: 'bg-amber-100 text-amber-600',
      sparkColor: '#F59E0B',
      to: '/assets?status=UNALLOCATED',
    },
    {
      label: 'Đang sửa chữa',
      value: kpis.maintenance || 0,
      meta: pctOf(kpis.maintenance || 0, kpis.totalAssets || 0),
      metaCls: 'text-violet-600',
      icon: Wrench,
      iconBg: 'bg-violet-100 text-violet-600',
      sparkColor: '#8B5CF6',
      to: '/maintenance',
    },
    // Row 2: License phần mềm
    {
      label: 'Tổng License',
      value: kpis.totalLicenses || 0,
      meta: `${kpis.licenseRecordsCount || 0} gói`,
      metaCls: 'text-indigo-600',
      icon: ShieldCheck,
      iconBg: 'bg-indigo-100 text-indigo-600',
      sparkColor: '#6366F1',
      to: '/software',
    },
    {
      label: 'Đang hoạt động',
      value: kpis.activeLicenses || 0,
      meta: pctOf(kpis.activeLicenses || 0, kpis.totalLicenses || 0),
      metaCls: 'text-emerald-600',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 text-emerald-600',
      sparkColor: '#22C55E',
      to: '/software?tab=licenses&status=ACTIVE',
    },
    {
      label: 'Sắp hết hạn',
      value: kpis.expiringLicenses || 0,
      meta: '≤ 30 ngày',
      metaCls: 'text-amber-600',
      icon: Clock,
      iconBg: 'bg-orange-100 text-orange-600',
      sparkColor: '#F97316',
      to: '/software?tab=licenses&status=EXPIRING_SOON',
    },
    {
      label: 'Đã hết hạn',
      value: kpis.expiredLicenses || 0,
      meta: pctOf(kpis.expiredLicenses || 0, kpis.totalLicenses || 0),
      metaCls: 'text-rose-600',
      icon: XCircle,
      iconBg: 'bg-rose-100 text-rose-600',
      sparkColor: '#EF4444',
      to: '/software?tab=licenses&status=EXPIRED',
    },
  ];

  const byTypeDonut = (charts.byType || []).map((item: any, idx: number) => ({
    name: item.name,
    value: item.value,
    color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
  }));

  const softwarePubDonut = (charts.softwareByPublisher || []).map((item: any, idx: number) => ({
    name: item.name,
    value: item.value,
    color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
  }));

  const byStatusDonut = (charts.byStatus || []).map((item: any, idx: number) => ({
    name: item.name,
    value: item.value,
    color: STATUS_DONUT_COLORS[item.name] || DONUT_PALETTE[idx % DONUT_PALETTE.length],
  }));

  const licenseStatusDonut = (charts.licenseByStatus || []).map((item: any) => ({
    name: item.name,
    value: item.value,
    color: LICENSE_STATUS_COLORS[item.key] || '#3B82F6',
  }));

  return (
    <div className="space-y-5">
      {/* Header gọn gàng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-ink-primary tracking-tight">
            Tổng quan hệ thống Tài sản & Bản quyền
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Theo dõi trực quan tài sản phần cứng, bản quyền phần mềm, hạn sử dụng và cảnh báo vận hành.
          </p>
        </div>
        <button onClick={() => load()} className="btn-secondary self-start sm:self-auto text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới dữ liệu
        </button>
      </div>

      {/* 8 KPI CARDS (2 CỘT TRÊN MOBILE, 4 CỘT TRÊN DESKTOP) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
        {kpiCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-slate-300 transition-all p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-3 overflow-hidden active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-xs font-medium text-ink-secondary truncate">{c.label}</div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-0.5">
                    <span className="text-lg sm:text-2xl font-bold text-ink-primary tabular-nums leading-none">
                      {c.value.toLocaleString('vi-VN')}
                    </span>
                    <span className={`text-[10px] sm:text-[11px] font-semibold tabular-nums ${c.metaCls}`}>{c.meta}</span>
                  </div>
                </div>
              </div>
              <div className="self-end hidden sm:block">
                <Sparkline color={c.sparkColor} variant={idx} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* HÀNG BIỂU ĐỒ 1: 3 CỘT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard
          title="Tài sản theo loại"
          icon={<BarChart3 className="w-4 h-4 text-indigo-600 shrink-0" />}
          linkTo="/assets"
          data={byTypeDonut}
          centerValue={kpis.totalAssets || 0}
          centerLabel="Tổng"
        />

        {/* Tài sản theo phòng ban */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <h2 className="text-sm font-semibold text-ink-primary truncate">Tài sản theo phòng ban</h2>
            </div>
            <Link to="/assets" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1 shrink-0">
              Xem chi tiết <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 min-h-[180px]">
            {(charts.byDepartment || []).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-ink-muted">Chưa có dữ liệu phòng ban</div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={charts.byDepartment || []} margin={{ top: 20, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10.5, fill: '#475569' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }} />
                  <Bar dataKey="value" name="Số thiết bị" fill="#4F8DF5" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <DonutCard
          title="Phần mềm đang cài đặt"
          icon={<Layers className="w-4 h-4 text-violet-600 shrink-0" />}
          linkTo="/software?tab=catalog"
          data={softwarePubDonut}
          centerValue={kpis.totalUniqueSoftware || 0}
          centerLabel="Phần mềm"
          emptyText="Chưa có dữ liệu từ Agent"
        />
      </div>

      {/* HÀNG BIỂU ĐỒ 2: 3 CỘT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutCard
          title="Tình trạng tài sản"
          icon={<CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
          linkTo="/assets"
          data={byStatusDonut}
          centerValue={kpis.totalAssets || 0}
          centerLabel="Tổng"
        />

        <DonutCard
          title="License theo trạng thái"
          icon={<Layers className="w-4 h-4 text-violet-600 shrink-0" />}
          linkTo="/software?tab=licenses"
          data={licenseStatusDonut}
          centerValue={kpis.totalLicenses || 0}
          centerLabel="Tổng"
          emptyText="Chưa có bản quyền phần mềm"
        />

        {/* License sắp hết hạn theo tháng */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarClock className="w-4 h-4 text-fuchsia-600 shrink-0" />
              <h2 className="text-sm font-semibold text-ink-primary truncate">License sắp hết hạn theo tháng</h2>
            </div>
            <Link to="/software?tab=licenses&status=EXPIRING_SOON" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1 shrink-0">
              Xem chi tiết <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={charts.licenseExpiringByMonth || []} margin={{ top: 20, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }} />
                <Bar dataKey="count" name="Số suất hết hạn" fill="#C94BC9" radius={[6, 6, 0, 0]} maxBarSize={32}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* HÀNG DƯỚI: TRUNG TÂM CẢNH BÁO & DANH SÁCH LICENSE SẮP HẾT HẠN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trung tâm cảnh báo */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-fuchsia-600" />
              <h2 className="text-sm font-semibold text-ink-primary">Trung tâm cảnh báo</h2>
            </div>
            <Link to="/alerts?tab=alerts" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="px-4 sm:px-5 pt-2.5 flex items-center gap-4 border-b border-slate-100 text-xs">
            {[
              { key: 'ALL', label: 'Tất cả', count: alertCenter.length },
              { key: 'ASSET', label: 'Tài sản', count: assetAlertCount },
              { key: 'LICENSE', label: 'License', count: licenseAlertCount },
            ].map((t) => {
              const active = alertTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAlertTab(t.key as any)}
                  className={`pb-2.5 border-b-2 font-medium inline-flex items-center gap-1.5 transition-colors ${
                    active ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                      active ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-ink-secondary'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {filteredAlerts.length === 0 ? (
              <div className="py-10 text-center text-xs text-ink-muted">
                Không có cảnh báo nào cần xử lý trong mục này.
              </div>
            ) : (
              filteredAlerts.slice(0, 5).map((al) => {
                const isCritical = al.severity === 'CRITICAL';
                const isWarning = al.severity === 'HIGH' || al.severity === 'MEDIUM';
                return (
                  <Link
                    key={al.id}
                    to={al.link}
                    className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isCritical
                            ? 'bg-rose-100 text-rose-600'
                            : isWarning
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-sky-100 text-sky-600'
                        }`}
                      >
                        {isCritical ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <MonitorOff className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-ink-primary truncate">{al.title}</div>
                        <div className="text-[11px] text-ink-muted truncate mt-0.5">
                          {al.message} • {formatRelativeTime(al.detectedAt)}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                        isCritical
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : isWarning
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {al.badgeLabel}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Danh sách License sắp hết hạn */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-ink-primary">Danh sách License sắp hết hạn</h2>
            </div>
            <Link to="/software?tab=licenses&status=EXPIRING_SOON" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-100 flex-1">
            {expiringLicenseList.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-ink-muted">
                Không có bản quyền nào sắp hết hạn trong 90 ngày tới.
              </div>
            ) : (
              expiringLicenseList.slice(0, 6).map((lic) => {
                const isExpired = lic.effectiveStatus === 'EXPIRED';
                const isSoon = lic.effectiveStatus === 'EXPIRING_SOON';
                return (
                  <Link
                    key={lic.id}
                    to={`/software/licenses/${lic.id}`}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink-primary truncate">{lic.name}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                        {lic.totalSeats} suất • HH: {formatDate(lic.expirationDate)}
                      </div>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        isExpired
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : isSoon
                            ? 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isExpired ? 'Đã hết hạn' : isSoon ? 'Sắp hết hạn' : 'Theo dõi'}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-secondary">Phần mềm</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-secondary">Số lượng</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-secondary">Ngày hết hạn</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-ink-secondary">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringLicenseList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-ink-muted">
                      Không có bản quyền nào sắp hết hạn trong 90 ngày tới.
                    </td>
                  </tr>
                ) : (
                  expiringLicenseList.slice(0, 6).map((lic) => {
                    const isExpired = lic.effectiveStatus === 'EXPIRED';
                    const isSoon = lic.effectiveStatus === 'EXPIRING_SOON';
                    return (
                      <tr key={lic.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-xs sm:text-sm">
                          <Link to={`/software/licenses/${lic.id}`} className="font-medium text-ink-primary hover:text-brand">
                            {lic.name}
                          </Link>
                          <div className="text-[11px] font-mono text-ink-muted">{lic.licenseCode}</div>
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm font-mono font-medium text-ink-primary tabular-nums">
                          {lic.totalSeats}
                        </td>
                        <td className="px-4 py-3 text-xs sm:text-sm font-mono text-ink-secondary whitespace-nowrap">
                          {formatDate(lic.expirationDate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isExpired
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : isSoon
                                  ? 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {isExpired ? 'Đã hết hạn' : isSoon ? 'Sắp hết hạn' : 'Theo dõi'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
