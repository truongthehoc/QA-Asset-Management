import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Sliders } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, SeverityBadge, AlertStatusBadge, Badge } from '../components/UiPrimitives';
import { formatDateTime } from '../utils/format';

export const AlertsPage: React.FC = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState<'changes' | 'alerts' | 'rules'>('changes');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [catFilter, setCatFilter] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [aRes, cRes, rRes] = await Promise.all([
      api.get('/alerts', { params: { ...(catFilter ? { category: catFilter } : {}), ...(sevFilter ? { severity: sevFilter } : {}) } }),
      api.get('/alerts/changes'),
      api.get('/alerts/rules'),
    ]);
    setAlerts(aRes.data);
    setChanges(cRes.data);
    setRules(rRes.data);
  };

  useEffect(() => {
    load();
    const onRealtime = () => load();
    window.addEventListener('itam:realtime-update', onRealtime);
    return () => window.removeEventListener('itam:realtime-update', onRealtime);
  }, [catFilter, sevFilter]);

  const handleVerifyChange = async (change: any, decision: 'APPROVED' | 'REJECTED') => {
    const notes = window.prompt(
      decision === 'APPROVED'
        ? `Xác nhận thay đổi ${change.component} (${change.previousValue} -> ${change.newValue}) và CẬP NHẬT Baseline mới? Ghi chú:`
        : `Từ chối thay đổi ${change.component} và giữ nguyên Baseline cũ? Ghi chú:`,
      decision === 'APPROVED' ? 'Đã xác minh thay đổi hợp lệ, cập nhật Baseline' : 'Chưa được phê duyệt, cần kiểm tra máy trạm',
    );
    if (notes === null) return;
    await api.post(`/alerts/changes/${change.id}/verify`, {
      decision,
      notes,
      updateBaseline: decision === 'APPROVED',
    });
    setMsg(
      decision === 'APPROVED'
        ? `Đã xác minh và cập nhật Baseline cho ${change.asset?.assetCode || change.agent?.hostname}.`
        : `Đã từ chối thay đổi trên ${change.asset?.assetCode || change.agent?.hostname}; Baseline cũ được giữ nguyên.`,
    );
    load();
  };

  const handleAlertStatus = async (alertId: string, status: string) => {
    const notes = window.prompt('Ghi chú xử lý cảnh báo (tùy chọn):', '');
    if (notes === null) return;
    await api.patch(`/alerts/${alertId}/status`, { status, notes });
    load();
  };

  const handleRuleUpdate = async (rule: any, patch: any) => {
    await api.patch(`/alerts/rules/${rule.id}`, patch);
    load();
  };

  const pendingChanges = changes.filter((c) => c.status === 'PENDING');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cảnh báo & Xác minh thay đổi cấu hình"
        subtitle="Mọi sai lệch giữa Snapshot thực tế và Baseline chuẩn được ghi nhận độc lập. Baseline chỉ cập nhật khi IT xác nhận."
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <button onClick={() => setTab('changes')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'changes' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Sai lệch cấu hình chờ xác minh ({pendingChanges.length} / {changes.length})
        </button>
        <button onClick={() => setTab('alerts')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'alerts' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Tất cả cảnh báo ({alerts.length})
        </button>
        <button onClick={() => setTab('rules')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-1.5 ${tab === 'rules' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          <Sliders className="w-3.5 h-3.5" /> Quy tắc & Mức độ cảnh báo ({rules.length})
        </button>
      </div>

      {/* TAB 1: CONFIG DRIFT VERIFICATION (SRS 5.4 & 5.5) */}
      {tab === 'changes' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Tài sản / Hostname</th>
                  <th className="th-cell">Thành phần</th>
                  <th className="th-cell">Baseline đã duyệt (Trước)</th>
                  <th className="th-cell">Snapshot thực tế (Sau)</th>
                  <th className="th-cell">Mức độ / Trạng thái</th>
                  <th className="th-cell">Thời điểm</th>
                  <th className="th-cell text-right">Xác minh IT</th>
                </tr>
              </thead>
              <tbody>
                {changes.length === 0 ? (
                  <tr><td colSpan={8} className="td-cell text-center text-ink-muted py-10">Không có thay đổi cấu hình nào.</td></tr>
                ) : (
                  changes.map((ch, idx) => (
                    <tr key={ch.id} className={ch.status === 'PENDING' ? 'bg-amber-50/30' : 'hover:bg-slate-50/70'}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell">
                        {ch.asset ? (
                          <Link to={`/assets/${ch.asset.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                            {ch.asset.assetCode}
                          </Link>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                        <span className="font-mono text-xs text-ink-secondary">{ch.agent?.hostname}</span>
                      </td>
                      <td className="td-cell font-semibold text-xs">{ch.component}</td>
                      <td className="td-cell text-xs text-slate-600 bg-red-50/30">{ch.previousValue}</td>
                      <td className="td-cell text-xs font-medium text-ink-primary bg-emerald-50/40">{ch.newValue}</td>
                      <td className="td-cell">
                        <div className="flex flex-col gap-1 items-start">
                          <SeverityBadge severity={ch.severity} />
                          <Badge
                            label={ch.status === 'PENDING' ? 'Chờ xác minh' : ch.status === 'APPROVED' ? 'Đã duyệt Baseline' : 'Đã từ chối'}
                            cls={ch.status === 'PENDING' ? 'bg-amber-50 text-amber-800 border-amber-200' : ch.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                          />
                        </div>
                        {ch.verifyNotes && <div className="text-[11px] text-ink-muted mt-1">{ch.verifiedBy?.fullName}: {ch.verifyNotes}</div>}
                      </td>
                      <td className="td-cell text-xs text-ink-secondary">{formatDateTime(ch.detectedAt)}</td>
                      <td className="td-cell text-right">
                        {ch.status === 'PENDING' && can('alerts.verify') && (
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => handleVerifyChange(ch, 'APPROVED')} className="btn-primary px-2.5 py-1 text-xs">
                              <CheckCircle className="w-3.5 h-3.5" /> Duyệt & Cập nhật Baseline
                            </button>
                            <button onClick={() => handleVerifyChange(ch, 'REJECTED')} className="btn-secondary px-2.5 py-1 text-xs">
                              <XCircle className="w-3.5 h-3.5" /> Từ chối
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL ALERTS */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          <div className="panel p-3 flex flex-wrap gap-3">
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-field w-48">
              <option value="">Tất cả nhóm cảnh báo</option>
              <option value="CONFIG_CHANGE">Thay đổi cấu hình</option>
              <option value="AGENT_OFFLINE">Agent Offline</option>
              <option value="WARRANTY">Bảo hành</option>
              <option value="SOFTWARE">Phần mềm</option>
              <option value="DISCOVERY">Thiết bị mới</option>
              <option value="SECURITY">An toàn / Định danh</option>
            </select>
            <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="input-field w-44">
              <option value="">Tất cả mức độ</option>
              <option value="CRITICAL">Nghiêm trọng</option>
              <option value="HIGH">Cao</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="INFO">Thông tin</option>
            </select>
          </div>

          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Mức độ</th>
                    <th className="th-cell">Nội dung cảnh báo</th>
                    <th className="th-cell">Tài sản / Nguồn</th>
                    <th className="th-cell">Trạng thái</th>
                    <th className="th-cell">Thời điểm</th>
                    <th className="th-cell text-right">Cập nhật trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((al, idx) => (
                    <tr key={al.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell"><SeverityBadge severity={al.severity} /></td>
                      <td className="td-cell max-w-md">
                        <div className="font-medium text-ink-primary">{al.title}</div>
                        <div className="text-xs text-ink-secondary mt-0.5">{al.message}</div>
                      </td>
                      <td className="td-cell text-xs">
                        {al.asset ? (
                          <Link to={`/assets/${al.asset.id}`} className="font-mono font-semibold text-brand hover:underline block">
                            {al.asset.assetCode}
                          </Link>
                        ) : (
                          <span>—</span>
                        )}
                        <span className="text-ink-muted">{al.source}</span>
                      </td>
                      <td className="td-cell"><AlertStatusBadge status={al.status} /></td>
                      <td className="td-cell text-xs text-ink-secondary">{formatDateTime(al.detectedAt)}</td>
                      <td className="td-cell text-right">
                        <select
                          value={al.status}
                          onChange={(e) => handleAlertStatus(al.id, e.target.value)}
                          className="input-field py-1 text-xs w-36"
                        >
                          <option value="NEW">Mới</option>
                          <option value="ACKNOWLEDGED">Đã tiếp nhận</option>
                          <option value="IN_PROGRESS">Đang xử lý</option>
                          <option value="CONFIRMED">Đã xác nhận</option>
                          <option value="CLOSED">Đã đóng</option>
                          <option value="IGNORED">Bỏ qua</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURABLE ALERT RULES (SRS 5.6) */}
      {tab === 'rules' && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs text-ink-secondary">
            Theo SRS Mục 5.6: Mức độ cảnh báo phải cấu hình được theo chính sách đơn vị, không cố định cứng trong mã nguồn.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã quy tắc</th>
                  <th className="th-cell">Tên quy tắc & Mô tả</th>
                  <th className="th-cell">Mức độ cảnh báo</th>
                  <th className="th-cell">Kích hoạt</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">{r.code}</td>
                    <td className="td-cell text-xs">
                      <div className="font-medium text-ink-primary">{r.name}</div>
                      <div className="text-ink-muted">{r.description}</div>
                    </td>
                    <td className="td-cell">
                      <select
                        disabled={!can('admin.settings')}
                        value={r.severity}
                        onChange={(e) => handleRuleUpdate(r, { severity: e.target.value })}
                        className="input-field py-1 text-xs w-36"
                      >
                        <option value="INFO">Thông tin</option>
                        <option value="MEDIUM">Trung bình</option>
                        <option value="HIGH">Cao</option>
                        <option value="CRITICAL">Nghiêm trọng</option>
                      </select>
                    </td>
                    <td className="td-cell">
                      <input
                        type="checkbox"
                        disabled={!can('admin.settings')}
                        checked={r.isEnabled}
                        onChange={(e) => handleRuleUpdate(r, { isEnabled: e.target.checked })}
                        className="w-4 h-4 accent-brand"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
