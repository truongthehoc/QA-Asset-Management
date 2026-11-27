import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Radar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Play,
  ShieldAlert,
  Cpu,
  Terminal,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Modal, AgentStatusBadge, Badge } from '../components/UiPrimitives';
import { formatDateTime, formatRelativeTime } from '../utils/format';

export const DiscoveryPage: React.FC = () => {
  const { can } = useAuth();
  const [tab, setTab] = useState<'pending' | 'all' | 'agents' | 'networks'>('pending');
  const [devices, setDevices] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], assetTypes: [], locations: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add Network Modal
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [netForm, setNetForm] = useState({ name: '', cidr: '', vlan: '', description: '' });

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [devRes, agRes, netRes, scanRes, metaRes] = await Promise.all([
        api.get('/discovery/devices'),
        api.get('/agents'),
        api.get('/discovery/networks'),
        api.get('/discovery/scans'),
        api.get('/admin/meta'),
      ]);
      setDevices(devRes.data);
      setAgents(agRes.data);
      setNetworks(netRes.data);
      setScans(scanRes.data);
      setMeta(metaRes.data);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const onRealtime = () => loadAll(true);
    window.addEventListener('itam:realtime-update', onRealtime);
    return () => window.removeEventListener('itam:realtime-update', onRealtime);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const handleIgnore = async (dev: any) => {
    const reason = window.prompt('Nhập lý do bỏ qua thiết bị này:', 'Thiết bị cá nhân / không thuộc diện quản lý');
    if (reason === null) return;
    await api.patch(`/discovery/devices/${dev.id}/ignore`, { reason });
    loadAll();
  };

  const handleRestore = async (dev: any) => {
    await api.patch(`/discovery/devices/${dev.id}/restore`);
    loadAll();
  };

  const handleRunScan = async (networkId: string) => {
    setScanningId(networkId);
    setFeedback(null);
    try {
      const res = await api.post(`/discovery/networks/${networkId}/scan`, { mode: 'ARP_PROBE' });
      setFeedback({
        type: 'ok',
        text: `Hoàn tất quét ${res.data.network?.cidr}: phát hiện ${res.data.hostsAlive} host phản hồi, ${res.data.newDevicesFound} thiết bị mới.`,
      });
      loadAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.response?.data?.message || 'Quét mạng thất bại.' });
    } finally {
      setScanningId(null);
    }
  };

  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/discovery/networks', netForm);
    setNetModalOpen(false);
    setNetForm({ name: '', cidr: '', vlan: '', description: '' });
    loadAll();
  };

  const handleRevokeAgent = async (agent: any) => {
    const reason = window.prompt(`Xác nhận thu hồi Agent ${agent.agentUid}? Nhập lý do:`, 'Máy thanh lý / cài đặt lại Agent');
    if (!reason) return;
    await api.patch(`/agents/${agent.id}/revoke`, { reason });
    loadAll();
  };

  const handleSyncCommand = async (agent: any) => {
    await api.post(`/agents/${agent.id}/commands`, { commandType: 'SYNC_INVENTORY' });
    setFeedback({ type: 'ok', text: `Đã xếp hàng lệnh SYNC_INVENTORY cho Agent ${agent.agentUid} (chỉ lệnh trong danh sách cho phép).` });
  };

  const pendingDevices = devices.filter((d) => ['PENDING', 'VERIFY_CONFLICT'].includes(d.approvalStatus));
  const lanScanEnabled = Boolean(meta?.features?.lanScanEnabled);

  useEffect(() => {
    if (!lanScanEnabled && tab === 'networks') {
      setTab('pending');
    }
  }, [lanScanEnabled, tab]);

  const visibleTabs = [
    { id: 'pending', label: `Thiết bị chờ duyệt (${pendingDevices.length})` },
    { id: 'all', label: `Tất cả thiết bị phát hiện (${devices.length})` },
    { id: 'agents', label: `Agent đã đăng ký (${agents.length})` },
    ...(lanScanEnabled ? [{ id: 'networks', label: `Quét mạng LAN (${networks.length})` }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Khám phá thiết bị & Kiểm duyệt"
        subtitle={
          lanScanEnabled
            ? 'Thiết bị đăng ký từ Windows Agent hoặc phát hiện qua LAN Discovery phải qua bước IT kiểm duyệt trước khi trở thành tài sản chính thức.'
            : 'Thiết bị đăng ký tự động từ Windows Agent phải qua bước IT kiểm duyệt trước khi trở thành tài sản chính thức.'
        }
        actions={
          <button onClick={() => loadAll()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Tải lại
          </button>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-md border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending & All Discovered Devices */}
      {(tab === 'pending' || tab === 'all') && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Thiết bị / Hostname</th>
                  <th className="th-cell">Nguồn</th>
                  <th className="th-cell">Mạng (IP / MAC)</th>
                  <th className="th-cell">Cấu hình thu thập</th>
                  <th className="th-cell">Trạng thái</th>
                  <th className="th-cell">Phát hiện gần nhất</th>
                  <th className="th-cell text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'pending' ? pendingDevices : devices).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="td-cell text-center text-ink-muted py-10">
                      Không có thiết bị nào trong danh sách này.
                    </td>
                  </tr>
                ) : (
                  (tab === 'pending' ? pendingDevices : devices).map((dev, idx) => (
                    <tr key={dev.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell">
                        <div className="font-medium text-ink-primary">{dev.hostname || 'Chưa phân giải tên'}</div>
                        <div className="text-xs text-ink-muted">
                          {dev.manufacturer || dev.macVendor || '—'} {dev.model || ''}
                        </div>
                        {dev.serialNumber && (
                          <div className="font-mono text-[11px] text-ink-secondary mt-0.5">SN: {dev.serialNumber}</div>
                        )}
                        {dev.conflictReason && (
                          <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            {dev.conflictReason}
                          </div>
                        )}
                      </td>
                      <td className="td-cell">
                        <Badge
                          label={dev.source === 'AGENT' ? 'Windows Agent' : dev.source === 'BOTH' ? 'Agent + LAN' : 'LAN (Chưa cài Agent)'}
                          cls={
                            dev.source === 'LAN_DISCOVERY'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }
                        />
                      </td>
                      <td className="td-cell font-mono text-xs">
                        <div>{dev.ipAddress || '—'}</div>
                        <div className="text-ink-muted">{dev.macAddress || '—'}</div>
                      </td>
                      <td className="td-cell text-xs">
                        {dev.cpuSummary ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-ink-primary">
                              <Cpu className="w-3.5 h-3.5 text-slate-400" /> {dev.cpuSummary}
                            </div>
                            <div className="text-ink-secondary">
                              RAM: {dev.ramTotalGb || '—'} GB • {dev.osName || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-muted italic">Chưa cài Windows Agent (chỉ có thông tin mạng)</span>
                        )}
                      </td>
                      <td className="td-cell">
                        {dev.approvalStatus === 'PENDING' && <Badge label="Chờ duyệt" cls="bg-amber-50 text-amber-800 border-amber-200" />}
                        {dev.approvalStatus === 'VERIFY_CONFLICT' && <Badge label="Cần xác minh trùng" cls="bg-red-50 text-red-700 border-red-200" />}
                        {dev.approvalStatus === 'APPROVED' && (
                          <Link to={`/assets/${dev.asset?.id}`} className="font-mono text-xs font-semibold text-emerald-700 hover:underline">
                            Đã duyệt: {dev.asset?.assetCode}
                          </Link>
                        )}
                        {dev.approvalStatus === 'IGNORED' && (
                          <div>
                            <Badge label="Đã bỏ qua" cls="bg-slate-100 text-slate-600 border-slate-200" />
                            {dev.ignoreReason && <div className="text-[11px] text-ink-muted mt-0.5">{dev.ignoreReason}</div>}
                          </div>
                        )}
                      </td>
                      <td className="td-cell text-xs text-ink-secondary">{formatRelativeTime(dev.lastSeenAt)}</td>
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {['PENDING', 'VERIFY_CONFLICT'].includes(dev.approvalStatus) && can('discovery.approve') && (
                            <>
                              <Link to={`/discovery/approve/${dev.id}`} className="btn-primary px-2.5 py-1.5 text-xs">
                                <CheckCircle className="w-3.5 h-3.5" /> Duyệt
                              </Link>
                              <button onClick={() => handleIgnore(dev)} className="btn-secondary px-2.5 py-1.5 text-xs">
                                <XCircle className="w-3.5 h-3.5" /> Bỏ qua
                              </button>
                            </>
                          )}
                          {dev.approvalStatus === 'IGNORED' && can('discovery.approve') && (
                            <button onClick={() => handleRestore(dev)} className="btn-secondary px-2.5 py-1.5 text-xs">
                              <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registered Agents Tab */}
      {tab === 'agents' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Agent UID / Hostname</th>
                  <th className="th-cell">Tài sản liên kết</th>
                  <th className="th-cell">Trạng thái</th>
                  <th className="th-cell">Phiên bản</th>
                  <th className="th-cell">IP / Hệ điều hành</th>
                  <th className="th-cell">Heartbeat gần nhất</th>
                  <th className="th-cell text-right">Điều khiển</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((ag, idx) => (
                  <tr key={ag.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell">
                      <div className="font-mono text-xs font-semibold text-ink-primary">{ag.agentUid}</div>
                      <div className="text-xs text-ink-secondary">{ag.hostname}</div>
                    </td>
                    <td className="td-cell">
                      {ag.asset ? (
                        <Link to={`/assets/${ag.asset.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                          {ag.asset.assetCode}
                        </Link>
                      ) : (
                        <Badge label="Chưa duyệt tài sản" cls="bg-amber-50 text-amber-800 border-amber-200" />
                      )}
                    </td>
                    <td className="td-cell">
                      <AgentStatusBadge status={ag.computedStatus || ag.status} />
                    </td>
                    <td className="td-cell font-mono text-xs">v{ag.agentVersion}</td>
                    <td className="td-cell text-xs">
                      <div className="font-mono">{ag.lastIpAddress || '—'}</div>
                      <div className="text-ink-muted">{ag.osSummary || '—'}</div>
                    </td>
                    <td className="td-cell text-xs text-ink-secondary">{formatRelativeTime(ag.lastHeartbeatAt)}</td>
                    <td className="td-cell text-right">
                      {ag.status !== 'REVOKED' && can('admin.settings') && (
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => handleSyncCommand(ag)} className="btn-secondary px-2 py-1 text-xs" title="Gửi lệnh đồng bộ inventory">
                            <Terminal className="w-3.5 h-3.5" /> Sync
                          </button>
                          <button onClick={() => handleRevokeAgent(ag)} className="btn-secondary text-red-600 hover:bg-red-50 px-2 py-1 text-xs">
                            Thu hồi
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LAN Discovery Networks & Scan History Tab */}
      {tab === 'networks' && (
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-primary">Danh sách dải mạng khai báo (LAN Discovery)</h2>
                <p className="text-xs text-ink-muted">LAN Discovery hỗ trợ phát hiện thiết bị và tìm máy chưa cài Windows Agent.</p>
              </div>
              {can('discovery.scan') && (
                <button onClick={() => setNetModalOpen(true)} className="btn-primary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Thêm dải mạng
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Tên khu vực / Mạng</th>
                    <th className="th-cell">Dải CIDR</th>
                    <th className="th-cell">VLAN</th>
                    <th className="th-cell">Mô tả</th>
                    <th className="th-cell text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {networks.map((n, idx) => (
                    <tr key={n.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell font-medium">{n.name}</td>
                      <td className="td-cell font-mono text-xs">{n.cidr}</td>
                      <td className="td-cell text-xs font-medium">{n.vlan || '—'}</td>
                      <td className="td-cell text-xs text-ink-secondary">{n.description || '—'}</td>
                      <td className="td-cell text-right">
                        {can('discovery.scan') && (
                          <button
                            disabled={scanningId === n.id}
                            onClick={() => handleRunScan(n.id)}
                            className="btn-primary px-2.5 py-1.5 text-xs"
                          >
                            <Play className="w-3.5 h-3.5" />
                            {scanningId === n.id ? 'Đang quét...' : 'Quét ngay'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="text-sm font-semibold text-ink-primary">Lịch sử quét mạng</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Dải mạng</th>
                    <th className="th-cell">Hình thức</th>
                    <th className="th-cell">Người thực hiện</th>
                    <th className="th-cell">Host phản hồi / Mới</th>
                    <th className="th-cell">Thời điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell text-xs">
                        <span className="font-medium">{s.network?.name}</span>{' '}
                        <span className="font-mono text-ink-muted">({s.network?.cidr})</span>
                      </td>
                      <td className="td-cell text-xs">{s.triggerType === 'MANUAL' ? 'Quét thủ công' : 'Định kỳ'}</td>
                      <td className="td-cell text-xs">{s.triggeredBy || '—'}</td>
                      <td className="td-cell text-xs tabular-nums">
                        {s.hostsAlive} phản hồi / <strong className="text-brand">{s.newDevicesFound} mới</strong>
                      </td>
                      <td className="td-cell text-xs text-ink-secondary">{formatDateTime(s.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Network Modal */}
      <Modal open={netModalOpen} onClose={() => setNetModalOpen(false)} title="Khai báo dải mạng LAN Discovery" maxWidth="max-w-lg">
        <form onSubmit={handleCreateNetwork} className="space-y-3.5">
          <div>
            <label className="label-field">Tên khu vực / VLAN <span className="text-red-500">*</span></label>
            <input required value={netForm.name} onChange={(e) => setNetForm({ ...netForm, name: e.target.value })} className="input-field" placeholder="Nhập tên khu vực hoặc VLAN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Dải IP (CIDR) <span className="text-red-500">*</span></label>
              <input required value={netForm.cidr} onChange={(e) => setNetForm({ ...netForm, cidr: e.target.value })} className="input-field font-mono" placeholder="Nhập dải IP" />
            </div>
            <div>
              <label className="label-field">VLAN</label>
              <input value={netForm.vlan} onChange={(e) => setNetForm({ ...netForm, vlan: e.target.value })} className="input-field" placeholder="Nhập tên VLAN" />
            </div>
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <input value={netForm.description} onChange={(e) => setNetForm({ ...netForm, description: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNetModalOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu dải mạng</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
