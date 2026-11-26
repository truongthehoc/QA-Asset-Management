import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HardDrive,
  CheckCircle2,
  PackageOpen,
  Clock,
  Wrench,
  ShieldAlert,
  WifiOff,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
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
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { api } from '../api/client';
import { PageHeader, SeverityBadge, AlertStatusBadge } from '../components/UiPrimitives';
import { CHART_COLORS, formatVnd, formatRelativeTime } from '../utils/format';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return <div className="text-sm text-ink-secondary py-12 text-center">Đang tải dữ liệu tổng quan...</div>;
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  const kpiCards = [
    { label: 'Tổng số tài sản', value: kpis.totalAssets, sub: formatVnd(kpis.totalValue), icon: HardDrive, accent: 'text-brand', to: '/assets' },
    { label: 'Đang sử dụng', value: kpis.inUse, sub: `Chưa phân bổ: ${kpis.unallocated || 0}`, icon: CheckCircle2, accent: 'text-emerald-600', to: '/assets?status=IN_USE' },
    { label: 'Thiết bị chờ duyệt', value: kpis.pendingApproval, sub: 'Từ Agent & LAN Discovery', icon: Clock, accent: 'text-amber-600', to: '/discovery' },
    { label: 'Cảnh báo cấu hình', value: kpis.unresolvedConfigAlerts, sub: 'Chưa xác minh Baseline', icon: AlertTriangle, accent: 'text-orange-600', to: '/alerts' },
    { label: 'Agent Offline', value: kpis.agentsOffline, sub: `Trực tuyến: ${kpis.agentsOnline || 0}`, icon: WifiOff, accent: 'text-red-600', to: '/discovery' },
    { label: 'Đang sửa chữa', value: kpis.maintenance, sub: 'Phiếu bảo trì mở', icon: Wrench, accent: 'text-amber-700', to: '/maintenance' },
    { label: 'Sắp hết bảo hành', value: kpis.warrantyExpiring, sub: 'Trong 60 ngày tới', icon: ShieldAlert, accent: 'text-orange-600', to: '/reports' },
    { label: 'Đã hết bảo hành', value: kpis.warrantyExpired, sub: 'Cần đánh giá thay thế', icon: PackageOpen, accent: 'text-slate-600', to: '/reports' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan hệ thống tài sản CNTT"
        subtitle="Theo dõi tập trung vòng đời tài sản, trạng thái Windows Agent và sai lệch cấu hình theo thời gian thực."
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
        }
      />

      {/* KPI Grid (SRS 8.1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="panel p-4 hover:border-slate-300 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-secondary">{c.label}</span>
                <Icon className={`w-4 h-4 ${c.accent}`} />
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-ink-primary tabular-nums">{c.value ?? 0}</span>
              </div>
              <div className="text-xs text-ink-muted mt-1 truncate tabular-nums">{c.sub}</div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-primary">Tài sản theo phòng ban sử dụng</h2>
            <span className="text-xs text-ink-muted">Số lượng thiết bị</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byDepartment || []} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#DFE4EC', fontSize: 12 }} />
                <Bar dataKey="value" name="Số lượng" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-primary">Tài sản theo loại thiết bị</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.byType || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {(charts.byType || []).map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#DFE4EC', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-ink-primary mb-3">Tài sản theo năm mua</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byYear || []} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#DFE4EC', fontSize: 12 }} />
                <Bar dataKey="count" name="Số tài sản" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-ink-primary mb-3">Biến động tài sản 6 tháng</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.movement || []} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#DFE4EC', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="added" name="Ghi nhận mới" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="transfers" name="Điều chuyển" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="repairs" name="Sửa chữa" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="text-sm font-semibold text-ink-primary mb-3">Cảnh báo đang mở theo mức độ</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.alertsBySeverity || []} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={84} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#DFE4EC', fontSize: 12 }} />
                <Bar dataKey="value" name="Số cảnh báo" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {(charts.alertsBySeverity || []).map((entry: any) => {
                    const colorMap: Record<string, string> = {
                      INFO: '#0284C7',
                      MEDIUM: '#D97706',
                      HIGH: '#EA580C',
                      CRITICAL: '#DC2626',
                    };
                    return <Cell key={entry.key} fill={colorMap[entry.key] || '#1D4ED8'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Operational Tables: Pending Config Changes + Recent Alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-primary">Thay đổi cấu hình phát hiện gần đây</h2>
            <Link to="/alerts" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1">
              Xác minh ngay <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Tài sản</th>
                  <th className="th-cell">Thành phần</th>
                  <th className="th-cell">Trước → Sau</th>
                  <th className="th-cell">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentChanges || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td-cell text-center text-ink-muted">
                      Chưa phát hiện thay đổi cấu hình nào.
                    </td>
                  </tr>
                ) : (
                  (data?.recentChanges || []).map((ch: any, idx: number) => (
                    <tr key={ch.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell">
                        {ch.asset ? (
                          <Link to={`/assets/${ch.asset.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                            {ch.asset.assetCode}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{ch.agent?.hostname}</span>
                        )}
                      </td>
                      <td className="td-cell">
                        <span className="text-xs font-semibold">{ch.component}</span>
                      </td>
                      <td className="td-cell text-xs">
                        <span className="line-through text-slate-400 mr-1.5">{ch.previousValue}</span>
                        <span className="font-medium text-ink-primary">{ch.newValue}</span>
                      </td>
                      <td className="td-cell">
                        <SeverityBadge severity={ch.severity} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-primary">Cảnh báo mới nhất</h2>
            <Link to="/alerts" className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1">
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.recentAlerts || []).slice(0, 6).map((al: any) => (
              <div key={al.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={al.severity} />
                    <AlertStatusBadge status={al.status} />
                    <span className="text-[11px] text-ink-muted">{formatRelativeTime(al.detectedAt)}</span>
                  </div>
                  <div className="text-sm font-medium text-ink-primary mt-1">{al.title}</div>
                  <div className="text-xs text-ink-secondary mt-0.5 line-clamp-1">{al.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
