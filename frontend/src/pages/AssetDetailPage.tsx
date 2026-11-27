import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  QrCode,
  Edit3,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Printer,
  ArrowLeftRight,
  Save,
  StickyNote,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, downloadAuthorizedFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AssetQrLabel, QrLabelConfig } from '../components/AssetQrLabel';
import { HandoverReceipt, ReceiptData } from '../components/HandoverReceipt';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import { TablePagination, usePagination } from '../components/TablePagination';
import {
  Modal,
  AssetStatusBadge,
  AgentStatusBadge,
  SeverityBadge,
  InventoryStatusBadge,
  Badge,
} from '../components/UiPrimitives';
import { formatDate, formatDateTime, formatVnd, formatBytes, DOC_TYPE_LABELS, formatAuditAction } from '../utils/format';

const TABS = [
  { id: 'overview', label: '1. Tổng quan' },
  { id: 'hardware', label: '2. Cấu hình' },
  { id: 'software', label: '3. Phần mềm' },
  { id: 'windows', label: '4. Windows & License' },
  { id: 'purchase', label: '5. Mua sắm & Hồ sơ' },
  { id: 'changes', label: '6. Lịch sử thay đổi' },
  { id: 'transfers', label: '7. Bàn giao & điều chuyển' },
  { id: 'maintenance', label: '8. Bảo trì' },
  { id: 'inventory', label: '9. Kiểm kê & Audit' },
  { id: 'notes', label: '10. Ghi chú' },
] as const;

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams();
  const { can } = useAuth();
  const [asset, setAsset] = useState<any>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modals
  const [qrOpen, setQrOpen] = useState(false);
  const [qrConfig, setQrConfig] = useState<QrLabelConfig | undefined>(undefined);
  const [orgInfo, setOrgInfo] = useState<any>(undefined);
  const [docTemplate, setDocTemplate] = useState<any>(undefined);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Purchase inline edit
  const [editingPurchase, setEditingPurchase] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    contractNumber: '',
    invoiceNumber: '',
    purchasePrice: '',
    fundingSource: '',
    purchaseDate: '',
    inUseDate: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    notes: '',
  });

  // Notes tab state
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeReason, setCodeReason] = useState('');

  // Document upload
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docType, setDocType] = useState('HANDOVER');
  const [docNotes, setDocNotes] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/assets/${id}`)
      .then((r) => {
        setAsset(r.data);
        setNotesDraft(r.data?.notes || '');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api
      .get('/admin/meta')
      .then((r) => {
        setQrConfig(r.data?.qrConfig);
        setOrgInfo(r.data?.orgInfo);
        setDocTemplate(r.data?.docTemplate);
        setSuppliers(r.data?.suppliers || []);
      })
      .catch(() => {});
  }, [id]);

  const toDateInput = (d?: string | null) => {
    if (!d) return '';
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const openPurchaseEdit = () => {
    const p = asset?.purchase || {};
    setPurchaseForm({
      supplierId: p.supplierId || '',
      contractNumber: p.contractNumber || '',
      invoiceNumber: p.invoiceNumber || '',
      purchasePrice: p.purchasePrice !== null && p.purchasePrice !== undefined ? String(p.purchasePrice) : '',
      fundingSource: p.fundingSource || '',
      purchaseDate: toDateInput(p.purchaseDate),
      inUseDate: toDateInput(p.inUseDate),
      warrantyStartDate: toDateInput(p.warrantyStartDate),
      warrantyEndDate: toDateInput(p.warrantyEndDate),
      notes: p.notes || '',
    });
    setEditingPurchase(true);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setSavingPurchase(true);
    setMsg(null);
    try {
      await api.patch(`/assets/${asset.id}`, {
        purchase: {
          supplierId: purchaseForm.supplierId || null,
          contractNumber: purchaseForm.contractNumber.trim() || null,
          invoiceNumber: purchaseForm.invoiceNumber.trim() || null,
          purchasePrice: purchaseForm.purchasePrice !== '' ? Number(purchaseForm.purchasePrice) : '',
          fundingSource: purchaseForm.fundingSource.trim() || null,
          purchaseDate: purchaseForm.purchaseDate || null,
          inUseDate: purchaseForm.inUseDate || null,
          warrantyStartDate: purchaseForm.warrantyStartDate || null,
          warrantyEndDate: purchaseForm.warrantyEndDate || null,
          notes: purchaseForm.notes.trim() || null,
        },
        reason: 'Cập nhật thông tin mua sắm & bảo hành',
      });
      setEditingPurchase(false);
      setMsg({ type: 'ok', text: 'Đã cập nhật thông tin mua sắm & bảo hành thành công.' });
      load();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Không thể cập nhật thông tin mua sắm.' });
    } finally {
      setSavingPurchase(false);
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setSavingNotes(true);
    setMsg(null);
    try {
      await api.patch(`/assets/${asset.id}`, {
        notes: notesDraft,
        reason: 'Cập nhật ghi chú tài sản',
      });
      setMsg({ type: 'ok', text: 'Đã lưu ghi chú tài sản thành công.' });
      load();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Không thể lưu ghi chú.' });
    } finally {
      setSavingNotes(false);
    }
  };

  const appendNoteTemplate = (snippet: string) => {
    setNotesDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n${snippet}` : snippet));
  };

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [msg]);

  // Pagination hooks for all list tables (must be called unconditionally before early returns)
  const agent = asset?.agents?.[0] || null;
  const latestSnap = agent?.snapshots?.[0] || null;
  const softwarePg = usePagination<any>(latestSnap?.software || [], 10);
  const docsPg = usePagination<any>(asset?.documents || [], 10);
  const changesPg = usePagination<any>(asset?.deviceChanges || [], 10);
  const transfersPg = usePagination<any>(asset?.transfers || [], 10);
  const assignmentsPg = usePagination<any>(asset?.assignments || [], 10);
  const maintenancesPg = usePagination<any>(asset?.maintenances || [], 10);
  const inventoryPg = usePagination<any>(asset?.inventoryItems || [], 10);
  const auditPg = usePagination<any>(asset?.auditLogs || [], 10);

  if (loading && !asset) {
    return <div className="py-12 text-center text-sm text-ink-secondary">Đang tải hồ sơ tài sản...</div>;
  }
  if (!asset) {
    return <div className="py-12 text-center text-sm text-red-600">Không tìm thấy tài sản.</div>;
  }

  const activeBaseline = asset.baselines?.find((b: any) => b.isActive) || asset.baselines?.[0] || null;
  const baselineObj = activeBaseline?.baselineJson ? JSON.parse(activeBaseline.baselineJson) : null;
  const os = latestSnap?.operatingSystem || null;

  const handleEditCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.patch(`/assets/${asset.id}/code`, { assetCode: newCode, reason: codeReason });
      setCodeModalOpen(false);
      setMsg({ type: 'ok', text: `Đã điều chỉnh mã tài sản sang ${newCode.trim()} và ghi nhận Audit Log.` });
      load();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Không thể điều chỉnh mã tài sản.' });
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('docType', docType);
      fd.append('notes', docNotes);
      await api.post(`/assets/${asset.id}/documents`, fd);
      setDocFile(null);
      setDocNotes('');
      setMsg({ type: 'ok', text: 'Đã tải lên hồ sơ đính kèm thành công.' });
      load();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.message || 'Lỗi tải tệp lên.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Xác nhận xóa hồ sơ đính kèm này?')) return;
    await api.delete(`/assets/documents/${docId}`);
    load();
  };

  const handleVerifyChange = async (changeId: string, decision: 'APPROVED' | 'REJECTED') => {
    const notes = window.prompt(
      decision === 'APPROVED'
        ? 'Xác nhận thay đổi và cập nhật Baseline mới? Nhập ghi chú xác minh:'
        : 'Từ chối thay đổi (giữ nguyên Baseline cũ)? Nhập lý do:',
      decision === 'APPROVED' ? 'Đã xác minh nâng cấp hợp lệ theo đề xuất IT' : 'Chưa được phê duyệt, yêu cầu kiểm tra thực tế',
    );
    if (notes === null) return;
    await api.post(`/alerts/changes/${changeId}/verify`, {
      decision,
      notes,
      updateBaseline: decision === 'APPROVED',
    });
    setMsg({
      type: 'ok',
      text:
        decision === 'APPROVED'
          ? 'Đã duyệt thay đổi và cập nhật phiên bản Baseline mới.'
          : 'Đã từ chối thay đổi; Baseline hiện hành vẫn được giữ nguyên.',
    });
    load();
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link to="/assets" className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-brand mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách tài sản
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm font-bold px-2.5 py-1 rounded bg-slate-900 text-white">
              {asset.assetCode}
            </span>
            <h1 className="text-xl font-semibold text-ink-primary">{asset.name}</h1>
            <AssetStatusBadge status={asset.status} />
            {agent && <AgentStatusBadge status={agent.status} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {can('assets.edit_code') && (
            <button
              onClick={() => {
                setNewCode(asset.assetCode);
                setCodeReason('');
                setCodeModalOpen(true);
              }}
              className="btn-secondary text-xs"
            >
              <Edit3 className="w-3.5 h-3.5" /> Điều chỉnh mã
            </button>
          )}
          {can('transfers.manage') && asset.status !== 'DISPOSED' && (
            <Link to={`/transfers/new?assetId=${asset.id}`} className="btn-secondary text-xs text-brand">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Cấp phát / Điều chuyển
            </Link>
          )}
          <button onClick={() => setQrOpen(true)} className="btn-primary text-xs">
            <QrCode className="w-3.5 h-3.5" /> Mã QR
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-md border text-sm ${
            msg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 10 SRS Tabs (Section 8.3) */}
      <div className="flex items-center gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: TỔNG QUAN */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="panel p-5 lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-ink-primary border-b border-line pb-2">Thông tin quản lý & sử dụng</h2>
            <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div><span className="text-xs text-ink-muted block">Mã tài sản ({asset.codeMode})</span><span className="font-mono font-semibold">{asset.assetCode}</span></div>
              <div><span className="text-xs text-ink-muted block">Serial Number</span><span className="font-mono">{asset.serialNumber || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Nhóm / Loại tài sản</span><span>{asset.category?.name} / {asset.assetType?.name}</span></div>
              <div><span className="text-xs text-ink-muted block">Hãng / Model</span><span>{asset.manufacturer || '—'} {asset.model || ''}</span></div>
              <div><span className="text-xs text-ink-muted block">Hostname</span><span className="font-mono">{asset.hostname || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Phòng ban quản lý</span><span>{asset.managingDepartment?.name || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Phòng ban sử dụng</span><span className="font-medium">{asset.usingDepartment?.name || 'Kho / Chưa phân bổ'}</span></div>
              <div><span className="text-xs text-ink-muted block">Người sử dụng</span><span className="font-medium">{asset.assignedUserName || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Vị trí đặt thiết bị</span><span>{asset.location?.name || '—'} {asset.locationDetail ? `(${asset.locationDetail})` : ''}</span></div>
              <div><span className="text-xs text-ink-muted block">Ngày bàn giao</span><span>{formatDate(asset.handoverDate)}</span></div>
              <div><span className="text-xs text-ink-muted block">Người bàn giao / tiếp nhận</span><span>{asset.handoverBy || '—'} → {asset.receivedBy || '—'}</span></div>
            </div>
            {asset.notes && (
              <div className="pt-3 border-t border-line text-sm">
                <span className="text-xs text-ink-muted block mb-1">Ghi chú nội bộ</span>
                <p className="text-ink-secondary">{asset.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="panel p-5 space-y-3">
              <h2 className="text-sm font-semibold text-ink-primary border-b border-line pb-2">Windows Agent liên kết</h2>
              {agent ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-ink-muted">Agent UID</span><span className="font-mono font-medium">{agent.agentUid}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Phiên bản</span><span className="font-mono">v{agent.agentVersion}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">IP gần nhất</span><span className="font-mono">{agent.lastIpAddress || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">MAC chính</span><span className="font-mono">{agent.primaryMac || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">SMBIOS UUID</span><span className="font-mono text-[11px] truncate max-w-[160px]">{agent.smbiosUuid || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Heartbeat cuối</span><span>{formatDateTime(agent.lastHeartbeatAt)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Baseline hiện hành</span><span className="font-semibold text-emerald-700">{activeBaseline ? `v${activeBaseline.version}` : 'Chưa thiết lập'}</span></div>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">Tài sản này chưa liên kết Windows Agent (thiết bị ngoại vi / mạng hoặc chưa cài Agent).</p>
              )}
            </div>

            <div className="panel p-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink-primary">Mã QR kiểm kê</div>
                <div className="font-mono text-xs text-ink-muted mt-0.5 truncate">{asset.assetCode}</div>
                <a
                  href={`${window.location.origin}/qr/${encodeURIComponent(asset.assetCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-brand hover:underline mt-1 inline-block"
                >
                  Mở thẻ QR công khai ↗
                </a>
              </div>
              <QRCodeSVG
                value={`${window.location.origin}/qr/${encodeURIComponent(asset.assetCode)}`}
                size={80}
                level="M"
                includeMargin
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CẤU HÌNH (BASELINE VS SNAPSHOT SEPARATION - PRINCIPLE 3) */}
      {tab === 'hardware' && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="panel p-5">
              <div className="flex items-center justify-between border-b border-line pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold text-ink-primary">
                    Cấu hình chuẩn (Baseline {activeBaseline ? `v${activeBaseline.version}` : '—'})
                  </h2>
                </div>
                {activeBaseline && (
                  <span className="text-[11px] text-ink-muted">
                    Xác nhận: {formatDate(activeBaseline.confirmedAt)} ({activeBaseline.confirmedBy?.fullName})
                  </span>
                )}
              </div>
              {baselineObj ? (
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">CPU</dt><dd className="font-medium text-right">{baselineObj.cpu}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">Tổng RAM</dt><dd className="font-mono font-semibold text-right">{baselineObj.totalRamGb} GB</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">Ổ đĩa</dt><dd className="text-right">{(baselineObj.disks || []).join(', ')}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">Mainboard</dt><dd className="text-right">{baselineObj.mainboard || '—'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">BIOS</dt><dd className="font-mono text-right">{baselineObj.bios || '—'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ink-muted">GPU</dt><dd className="text-right">{(baselineObj.gpu || []).join(', ') || '—'}</dd></div>
                </dl>
              ) : (
                <p className="text-xs text-ink-muted">Chưa có dữ liệu Baseline phần cứng cho tài sản này.</p>
              )}
            </div>

            <div className="panel p-5">
              <div className="flex items-center justify-between border-b border-line pb-2.5 mb-3">
                <h2 className="text-sm font-semibold text-ink-primary">Cấu hình thực tế (Snapshot gần nhất)</h2>
                {latestSnap && <span className="text-[11px] text-ink-muted">Thu thập: {formatDateTime(latestSnap.collectedAt)}</span>}
              </div>
              {latestSnap ? (
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">CPU</dt>
                    <dd className="font-medium text-right">
                      {latestSnap.processors?.map((p: any) => `${p.name} (${p.cores}C/${p.logicalProcessors}T)`).join('; ') || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Tổng RAM thực tế</dt>
                    <dd className={`font-mono font-semibold text-right ${baselineObj && baselineObj.totalRamGb !== latestSnap.totalRamGb ? 'text-orange-700 bg-orange-50 px-1.5 rounded' : ''}`}>
                      {latestSnap.totalRamGb} GB
                      {baselineObj && baselineObj.totalRamGb !== latestSnap.totalRamGb && ' (Khác Baseline!)'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Mainboard</dt>
                    <dd className="text-right">{latestSnap.mainboardMfg} {latestSnap.mainboardProduct} ({latestSnap.mainboardSerial || '—'})</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">BIOS</dt>
                    <dd className="font-mono text-right">{latestSnap.biosMfg} {latestSnap.biosVersion} ({latestSnap.biosReleaseDate || '—'})</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">GPU</dt>
                    <dd className="text-right">{latestSnap.graphics?.map((g: any) => g.name).join(', ') || '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-ink-muted">Chưa có Snapshot từ Windows Agent.</p>
              )}
            </div>
          </div>

          {latestSnap && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="panel overflow-hidden">
                <div className="px-4 py-2.5 border-b border-line text-xs font-semibold">Chi tiết từng thanh RAM ({latestSnap.memoryModules?.length || 0})</div>
                <table className="w-full text-xs">
                  <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Khe</th><th className="th-cell">Dung lượng</th><th className="th-cell">Loại / Bus</th><th className="th-cell">Hãng / Serial</th></tr></thead>
                  <tbody>
                    {(latestSnap.memoryModules || []).map((m: any, idx: number) => (
                      <tr key={m.id}>
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                        <td className="td-cell font-mono text-xs">{m.slot || '—'}</td>
                        <td className="td-cell font-mono font-semibold text-xs">{m.capacityGb} GB</td>
                        <td className="td-cell text-xs">{m.memoryType || '—'} {m.speedMhz ? `${m.speedMhz} MHz` : ''}</td>
                        <td className="td-cell text-xs">{m.manufacturer || '—'} <span className="font-mono text-ink-muted">{m.serialNumber || ''}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel overflow-hidden">
                <div className="px-4 py-2.5 border-b border-line text-xs font-semibold">Ổ đĩa lưu trữ ({latestSnap.disks?.length || 0})</div>
                <table className="w-full text-xs">
                  <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Model</th><th className="th-cell">Loại</th><th className="th-cell">Dung lượng / Trống</th><th className="th-cell">Serial</th></tr></thead>
                  <tbody>
                    {(latestSnap.disks || []).map((d: any, idx: number) => (
                      <tr key={d.id}>
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                        <td className="td-cell text-xs font-medium">{d.model}</td>
                        <td className="td-cell text-xs">{d.mediaType || '—'}</td>
                        <td className="td-cell font-mono text-xs">{d.sizeGb} GB {d.freeGb != null ? `(Trống ${d.freeGb} GB)` : ''}</td>
                        <td className="td-cell font-mono text-xs text-ink-muted">{d.serialNumber || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel overflow-hidden lg:col-span-2">
                <div className="px-4 py-2.5 border-b border-line text-xs font-semibold">Card mạng & Màn hình</div>
                <table className="w-full text-xs">
                  <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Adapter</th><th className="th-cell">MAC</th><th className="th-cell">IP</th><th className="th-cell">Tốc độ / Trạng thái</th></tr></thead>
                  <tbody>
                    {(latestSnap.networkAdapters || []).map((n: any, idx: number) => (
                      <tr key={n.id}>
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                        <td className="td-cell text-xs">{n.name} {n.isVirtual ? '(Ảo)' : ''}</td>
                        <td className="td-cell font-mono text-xs">{n.macAddress || '—'}</td>
                        <td className="td-cell font-mono text-xs">{n.ipAddress || '—'}</td>
                        <td className="td-cell text-xs">{n.speedMbps ? `${n.speedMbps} Mbps` : '—'} • {n.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PHẦN MỀM */}
      {tab === 'software' && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="text-sm font-semibold">Phần mềm đã cài đặt ({latestSnap?.software?.length || 0})</span>
            <span className="text-xs text-ink-muted">Thu thập từ Windows Registry Uninstall (32-bit & 64-bit)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Tên phần mềm</th>
                  <th className="th-cell">Nhà phát hành</th>
                  <th className="th-cell">Phiên bản</th>
                  <th className="th-cell">Kiến trúc</th>
                  <th className="th-cell">Ngày cài</th>
                  <th className="th-cell">Cảnh báo chính sách</th>
                </tr>
              </thead>
              <tbody>
                {softwarePg.totalItems === 0 ? (
                  <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-8">Không có dữ liệu phần mềm.</td></tr>
                ) : (
                  softwarePg.paginated.map((sw: any, idx: number) => (
                    <tr key={sw.id} className={sw.isUnauthorized ? 'bg-red-50/50' : ''}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{softwarePg.startIndex + idx + 1}</td>
                      <td className="td-cell font-medium">{sw.displayName}</td>
                      <td className="td-cell text-xs text-ink-secondary">{sw.publisher || '—'}</td>
                      <td className="td-cell font-mono text-xs">{sw.displayVersion || '—'}</td>
                      <td className="td-cell font-mono text-xs">{sw.architecture || '—'}</td>
                      <td className="td-cell text-xs">{sw.installDate || '—'}</td>
                      <td className="td-cell">
                        {sw.isUnauthorized ? (
                          <Badge label="Cần kiểm tra / Không cho phép" cls="bg-red-50 text-red-700 border-red-200" />
                        ) : (
                          <Badge label="Hợp lệ" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={softwarePg.totalItems}
            page={softwarePg.page}
            pageSize={softwarePg.pageSize}
            onPageChange={softwarePg.setPage}
            onPageSizeChange={softwarePg.setPageSize}
            unitLabel="phần mềm"
          />
        </div>
      )}

      {/* TAB 4: WINDOWS & LICENSE */}
      {tab === 'windows' && (
        <div className="panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-semibold">Thông tin hệ điều hành & Trạng thái kích hoạt Windows</h2>
            {os && (
              <Badge
                label={os.activationStatus === 'ACTIVATED' ? 'Đã kích hoạt (Activated)' : 'Chưa kích hoạt'}
                cls={os.activationStatus === 'ACTIVATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}
              />
            )}
          </div>
          {os ? (
            <>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-xs text-ink-muted block">Product Name</span><span className="font-medium">{os.productName}</span></div>
                <div><span className="text-xs text-ink-muted block">Edition / Architecture</span><span>{os.edition || '—'} ({os.architecture || '64-bit'})</span></div>
                <div><span className="text-xs text-ink-muted block">Version / Build</span><span className="font-mono">{os.version || '—'} (Build {os.buildNumber || '—'})</span></div>
                <div><span className="text-xs text-ink-muted block">License Channel</span><span className="font-mono">{os.licenseChannel || '—'}</span></div>
                <div><span className="text-xs text-ink-muted block">Partial Product Key (5 ký tự cuối)</span><span className="font-mono font-semibold">*****-*****-*****-*****-{os.partialProductKey || '-----'}</span></div>
                <div><span className="text-xs text-ink-muted block">Kiểm tra gần nhất</span><span>{formatDateTime(os.checkedAt)}</span></div>
                <div className="sm:col-span-3"><span className="text-xs text-ink-muted block">Mô tả License</span><span className="text-xs text-ink-secondary">{os.licenseDescription || '—'}</span></div>
              </div>
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Lưu ý bảo mật & kiểm toán (SRS 4.6):</strong> Hệ thống tuyệt đối không thu thập hay lưu trữ toàn bộ Windows Product Key. Trạng thái <em>Activated</em> không tự động chứng minh bản quyền hợp pháp; chứng từ bản quyền cần được lưu riêng trong tab Hồ sơ.
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Chưa có dữ liệu Windows từ Agent.</p>
          )}
        </div>
      )}

      {/* TAB 5: MUA SẮM & HỒ SƠ ĐÍNH KÈM */}
      {tab === 'purchase' && (
        <div className="space-y-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5 mb-4">
            <h2 className="text-sm font-semibold">Thông tin mua sắm & bảo hành</h2>
            {can('assets.update') && !editingPurchase && (
              <button type="button" onClick={openPurchaseEdit} className="btn-secondary px-2.5 py-1 text-xs">
                <Edit3 className="w-3.5 h-3.5" /> Cập nhật thông tin mua sắm
              </button>
            )}
          </div>

          {editingPurchase ? (
            <form onSubmit={handleSavePurchase} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="label-field">Nhà cung cấp</label>
                  <select
                    value={purchaseForm.supplierId}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">-- Chọn nhà cung cấp --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Số hợp đồng</label>
                  <input
                    value={purchaseForm.contractNumber}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, contractNumber: e.target.value })}
                    className="input-field font-mono"
                    placeholder="Nhập số hợp đồng"
                  />
                </div>
                <div>
                  <label className="label-field">Số hóa đơn</label>
                  <input
                    value={purchaseForm.invoiceNumber}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                    className="input-field font-mono"
                    placeholder="Nhập số hóa đơn"
                  />
                </div>
                <div>
                  <label className="label-field">Giá mua (VNĐ)</label>
                  <CurrencyInput
                    value={purchaseForm.purchasePrice}
                    onChange={(val) => setPurchaseForm({ ...purchaseForm, purchasePrice: val })}
                    placeholder="Nhập giá mua"
                  />
                </div>
                <div>
                  <label className="label-field">Nguồn kinh phí</label>
                  <input
                    value={purchaseForm.fundingSource}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, fundingSource: e.target.value })}
                    className="input-field"
                    placeholder="Nhập nguồn kinh phí"
                  />
                </div>
                <div>
                  <label className="label-field">Ngày mua</label>
                  <DateInputVN
                    value={purchaseForm.purchaseDate}
                    onChange={(iso) => setPurchaseForm({ ...purchaseForm, purchaseDate: iso })}
                  />
                </div>
                <div>
                  <label className="label-field">Ngày đưa vào sử dụng</label>
                  <DateInputVN
                    value={purchaseForm.inUseDate}
                    onChange={(iso) => setPurchaseForm({ ...purchaseForm, inUseDate: iso })}
                  />
                </div>
                <div>
                  <label className="label-field">Bắt đầu bảo hành</label>
                  <DateInputVN
                    value={purchaseForm.warrantyStartDate}
                    onChange={(iso) => setPurchaseForm({ ...purchaseForm, warrantyStartDate: iso })}
                  />
                </div>
                <div>
                  <label className="label-field">Kết thúc bảo hành</label>
                  <DateInputVN
                    value={purchaseForm.warrantyEndDate}
                    onChange={(iso) => setPurchaseForm({ ...purchaseForm, warrantyEndDate: iso })}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label-field">Ghi chú mua sắm / bảo hành</label>
                  <textarea
                    rows={2}
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="input-field"
                    placeholder="Điều kiện bảo hành, đầu mối hỗ trợ NCC..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setEditingPurchase(false)} className="btn-secondary">
                  Hủy
                </button>
                <button type="submit" disabled={savingPurchase} className="btn-primary">
                  <Save className="w-4 h-4" /> {savingPurchase ? 'Đang lưu...' : 'Lưu thông tin mua sắm'}
                </button>
              </div>
            </form>
          ) : asset.purchase ? (
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><span className="text-xs text-ink-muted block">Nhà cung cấp</span><span className="font-medium">{asset.purchase.supplier?.name || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Số hợp đồng</span><span className="font-mono">{asset.purchase.contractNumber || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Số hóa đơn</span><span className="font-mono">{asset.purchase.invoiceNumber || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Giá mua</span><span className="font-semibold text-brand tabular-nums">{formatVnd(asset.purchase.purchasePrice)}</span></div>
              <div><span className="text-xs text-ink-muted block">Nguồn kinh phí</span><span>{asset.purchase.fundingSource || '—'}</span></div>
              <div><span className="text-xs text-ink-muted block">Ngày mua / Đưa vào sử dụng</span><span>{formatDate(asset.purchase.purchaseDate)} / {formatDate(asset.purchase.inUseDate)}</span></div>
              <div><span className="text-xs text-ink-muted block">Bắt đầu bảo hành</span><span>{formatDate(asset.purchase.warrantyStartDate)}</span></div>
              <div><span className="text-xs text-ink-muted block">Kết thúc bảo hành</span><span className="font-medium">{formatDate(asset.purchase.warrantyEndDate)}</span></div>
              {asset.purchase.notes && (
                <div className="sm:col-span-3 pt-2 border-t border-line">
                  <span className="text-xs text-ink-muted block">Ghi chú mua sắm</span>
                  <span className="text-xs text-ink-secondary whitespace-pre-wrap">{asset.purchase.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Chưa cập nhật thông tin mua sắm.</p>
          )}
        </div>

        {/* HỒ SƠ ĐÍNH KÈM (REAL FILE UPLOAD & DOWNLOAD) */}
        <div className="panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-primary">
              Hồ sơ &amp; Chứng từ đính kèm ({asset.documents?.length || 0})
            </h3>
            {can('assets.documents') && (
              <button
                type="button"
                onClick={() => setShowDocUpload((v) => !v)}
                className={showDocUpload ? 'btn-secondary px-2.5 py-1 text-xs' : 'btn-primary px-2.5 py-1 text-xs'}
              >
                <Upload className="w-3.5 h-3.5" /> {showDocUpload ? 'Đóng khung tải lên' : 'Cập nhật hồ sơ'}
              </button>
            )}
          </div>

          {can('assets.documents') && showDocUpload && (
            <form onSubmit={handleUploadDoc} className="p-4 bg-slate-50/80 border-b border-line flex flex-wrap items-end gap-3">
              <div>
                <label className="label-field">Loại hồ sơ</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field w-48">
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="label-field">Chọn tệp (PDF, Ảnh, DOCX, XLSX — tối đa 15MB) <span className="text-red-500">*</span></label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="input-field py-1.5"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="label-field">Ghi chú hồ sơ</label>
                <input value={docNotes} onChange={(e) => setDocNotes(e.target.value)} className="input-field" placeholder="Nhập ghi chú hồ sơ" />
              </div>
              <button type="submit" disabled={uploading || !docFile} className="btn-primary">
                <Upload className="w-4 h-4" /> {uploading ? 'Đang tải...' : 'Tải lên'}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Loại hồ sơ</th>
                  <th className="th-cell">Tên tập tin</th>
                  <th className="th-cell">Dung lượng</th>
                  <th className="th-cell">Người tải lên / Thời điểm</th>
                  <th className="th-cell text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {docsPg.totalItems === 0 ? (
                  <tr><td colSpan={6} className="td-cell text-center text-ink-muted py-8">Chưa có hồ sơ đính kèm.</td></tr>
                ) : (
                  docsPg.paginated.map((doc: any, idx: number) => (
                    <tr key={doc.id}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{docsPg.startIndex + idx + 1}</td>
                      <td className="td-cell text-xs font-medium">{DOC_TYPE_LABELS[doc.docType] || doc.docType}</td>
                      <td className="td-cell">
                        <div className="text-sm font-medium">{doc.originalName}</div>
                        {doc.notes && <div className="text-xs text-ink-muted">{doc.notes}</div>}
                      </td>
                      <td className="td-cell font-mono text-xs">{formatBytes(doc.sizeBytes)}</td>
                      <td className="td-cell text-xs">{doc.uploadedBy?.fullName || '—'} • {formatDateTime(doc.uploadedAt)}</td>
                      <td className="td-cell text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => downloadAuthorizedFile(`/assets/documents/${doc.id}/download`, doc.originalName)}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            <Download className="w-3.5 h-3.5" /> Tải về
                          </button>
                          {can('assets.documents') && (
                            <button onClick={() => handleDeleteDoc(doc.id)} className="btn-secondary text-red-600 px-2 py-1 text-xs">
                              <Trash2 className="w-3.5 h-3.5" />
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
          <TablePagination
            totalItems={docsPg.totalItems}
            page={docsPg.page}
            pageSize={docsPg.pageSize}
            onPageChange={docsPg.setPage}
            onPageSizeChange={docsPg.setPageSize}
            unitLabel="hồ sơ"
          />
        </div>
        </div>
      )}

      {/* TAB 7: LỊCH SỬ THAY ĐỔI CẤU HÌNH */}
      {tab === 'changes' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Thời điểm</th>
                <th className="th-cell">Thành phần</th>
                <th className="th-cell">Giá trị Baseline (Trước)</th>
                <th className="th-cell">Giá trị Snapshot (Sau)</th>
                <th className="th-cell">Mức độ / Trạng thái</th>
                <th className="th-cell text-right">Xác minh IT</th>
              </tr>
            </thead>
            <tbody>
              {changesPg.totalItems === 0 ? (
                <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-8">Chưa ghi nhận thay đổi cấu hình nào.</td></tr>
              ) : (
                changesPg.paginated.map((ch: any, idx: number) => (
                  <tr key={ch.id}>
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{changesPg.startIndex + idx + 1}</td>
                    <td className="td-cell text-xs">{formatDateTime(ch.detectedAt)}</td>
                    <td className="td-cell font-semibold text-xs">{ch.component}</td>
                    <td className="td-cell text-xs text-slate-500">{ch.previousValue}</td>
                    <td className="td-cell text-xs font-medium text-ink-primary">{ch.newValue}</td>
                    <td className="td-cell">
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={ch.severity} />
                        <Badge
                          label={ch.status === 'PENDING' ? 'Chờ xác minh' : ch.status === 'APPROVED' ? 'Đã cập nhật Baseline' : 'Đã từ chối'}
                          cls={ch.status === 'PENDING' ? 'bg-amber-50 text-amber-800 border-amber-200' : ch.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                        />
                      </div>
                      {ch.verifyNotes && <div className="text-[11px] text-ink-muted mt-1">{ch.verifiedBy?.fullName}: {ch.verifyNotes}</div>}
                    </td>
                    <td className="td-cell text-right">
                      {ch.status === 'PENDING' && can('alerts.verify') && (
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => handleVerifyChange(ch.id, 'APPROVED')} className="btn-primary px-2.5 py-1 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> Duyệt & Cập nhật Baseline
                          </button>
                          <button onClick={() => handleVerifyChange(ch.id, 'REJECTED')} className="btn-secondary px-2.5 py-1 text-xs">
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
          <TablePagination
            totalItems={changesPg.totalItems}
            page={changesPg.page}
            pageSize={changesPg.pageSize}
            onPageChange={changesPg.setPage}
            onPageSizeChange={changesPg.setPageSize}
            unitLabel="thay đổi"
          />
        </div>
      )}

      {/* TAB 8: BÀN GIAO & ĐIỀU CHUYỂN */}
      {tab === 'transfers' && (
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Lịch sử điều chuyển & thu hồi ({asset.transfers?.length || 0})</span>
              {can('transfers.manage') && asset.status !== 'DISPOSED' && (
                <Link to={`/transfers/new?assetId=${asset.id}`} className="btn-secondary px-2.5 py-1 text-xs text-brand">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Lập phiếu mới
                </Link>
              )}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã phiếu</th>
                  <th className="th-cell">Từ phòng ban / Người dùng</th>
                  <th className="th-cell">Đến phòng ban / Người dùng</th>
                  <th className="th-cell">Lý do</th>
                  <th className="th-cell">Ngày</th>
                  <th className="th-cell text-right">Biên bản</th>
                </tr>
              </thead>
              <tbody>
                {transfersPg.totalItems === 0 ? (
                  <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-6">Chưa có lịch sử điều chuyển hoặc thu hồi.</td></tr>
                ) : (
                  transfersPg.paginated.map((tr: any, idx: number) => {
                    const isReturn = !tr.toDepartmentId && (!tr.toUserName || tr.toUserName === 'Kho IT');
                    return (
                      <tr key={tr.id} className="hover:bg-slate-50/70">
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{transfersPg.startIndex + idx + 1}</td>
                        <td className="td-cell font-mono text-xs font-semibold">{tr.transferCode}</td>
                        <td className="td-cell text-xs">{tr.fromDepartment?.name || 'Kho'} / {tr.fromUserName || '—'}</td>
                        <td className="td-cell text-xs font-medium">{tr.toDepartment?.name || 'Kho'} / {tr.toUserName || '—'}</td>
                        <td className="td-cell text-xs">{tr.reason}</td>
                        <td className="td-cell text-xs">{formatDate(tr.transferDate)}</td>
                        <td className="td-cell text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setReceipt({
                                kind: isReturn ? 'RETURN' : 'TRANSFER',
                                code: tr.transferCode,
                                date: tr.transferDate || tr.createdAt,
                                companyName: qrConfig?.labelTitle,
                                orgInfo,
                                docTemplate,
                                asset: {
                                  assetCode: asset.assetCode,
                                  name: asset.name,
                                  assetTypeName: asset.assetType?.name,
                                  serialNumber: asset.serialNumber,
                                  manufacturer: asset.manufacturer,
                                  model: asset.model,
                                },
                                fromDepartment: tr.fromDepartment?.name || docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin',
                                toDepartment: isReturn
                                  ? (docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin')
                                  : tr.toDepartment?.name || '—',
                                handoverBy: tr.handoverBy || '',
                                receivedBy: tr.receivedBy || '',
                                reason: tr.reason,
                                notes: tr.notes || undefined,
                              })
                            }
                            className="btn-secondary px-2.5 py-1 text-xs"
                            title="Xem & In biên bản"
                          >
                            <Printer className="w-3.5 h-3.5" /> Biên bản
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
            <TablePagination
              totalItems={transfersPg.totalItems}
              page={transfersPg.page}
              pageSize={transfersPg.pageSize}
              onPageChange={transfersPg.setPage}
              onPageSizeChange={transfersPg.setPageSize}
              unitLabel="phiếu"
            />
          </div>
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-sm font-semibold">Lịch sử bàn giao ({asset.assignments?.length || 0})</div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã phiếu</th>
                  <th className="th-cell">Phòng ban</th>
                  <th className="th-cell">Người sử dụng</th>
                  <th className="th-cell">Bàn giao / Tiếp nhận</th>
                  <th className="th-cell">Ngày bàn giao</th>
                  <th className="th-cell text-right">Biên bản</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsPg.totalItems === 0 ? (
                  <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-6">Chưa có lịch sử bàn giao.</td></tr>
                ) : (
                  assignmentsPg.paginated.map((asg: any, idx: number) => (
                    <tr key={asg.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{assignmentsPg.startIndex + idx + 1}</td>
                      <td className="td-cell font-mono text-xs font-semibold">{asg.assignmentCode}</td>
                      <td className="td-cell text-xs">{asg.department?.name || '—'}</td>
                      <td className="td-cell text-xs font-medium">{asg.assigneeName}</td>
                      <td className="td-cell text-xs">{asg.handoverBy} → {asg.receivedBy}</td>
                      <td className="td-cell text-xs">{formatDate(asg.handoverDate)}</td>
                      <td className="td-cell text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setReceipt({
                              kind: 'HANDOVER',
                              code: asg.assignmentCode,
                              date: asg.handoverDate || asg.createdAt,
                              companyName: qrConfig?.labelTitle,
                              orgInfo,
                              docTemplate,
                              asset: {
                                assetCode: asset.assetCode,
                                name: asset.name,
                                assetTypeName: asset.assetType?.name,
                                serialNumber: asset.serialNumber,
                                manufacturer: asset.manufacturer,
                                model: asset.model,
                              },
                              fromDepartment: docTemplate?.departmentSubtitle || 'Phòng Công nghệ Thông tin',
                              toDepartment: asg.department?.name || '—',
                              handoverBy: asg.handoverBy || '',
                              receivedBy: asg.receivedBy || '',
                              reason: 'Cấp phát / Bàn giao tài sản cho đơn vị sử dụng',
                              notes: asg.notes || undefined,
                            })
                          }
                          className="btn-secondary px-2.5 py-1 text-xs"
                          title="Xem & In biên bản"
                        >
                          <Printer className="w-3.5 h-3.5" /> Biên bản
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <TablePagination
              totalItems={assignmentsPg.totalItems}
              page={assignmentsPg.page}
              pageSize={assignmentsPg.pageSize}
              onPageChange={assignmentsPg.setPage}
              onPageSizeChange={assignmentsPg.setPageSize}
              unitLabel="phiếu"
            />
          </div>
        </div>
      )}

      {/* TAB 9: BẢO TRÌ */}
      {tab === 'maintenance' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Mã phiếu</th><th className="th-cell">Tình trạng / Nội dung</th><th className="th-cell">Đơn vị sửa chữa</th><th className="th-cell">Linh kiện</th><th className="th-cell">Chi phí</th><th className="th-cell">Trạng thái</th></tr></thead>
            <tbody>
              {maintenancesPg.totalItems === 0 ? (
                <tr><td colSpan={7} className="td-cell text-center text-ink-muted py-8">Chưa có phiếu sửa chữa / bảo trì.</td></tr>
              ) : (
                maintenancesPg.paginated.map((m: any, idx: number) => (
                  <tr key={m.id}>
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{maintenancesPg.startIndex + idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold">{m.ticketCode}</td>
                    <td className="td-cell text-xs">
                      <div className="font-medium">{m.issueSummary}</div>
                      <div className="text-ink-muted">{m.workPerformed || ''}</div>
                    </td>
                    <td className="td-cell text-xs">{m.vendorName || '—'}</td>
                    <td className="td-cell text-xs">{m.replacedParts || '—'}</td>
                    <td className="td-cell font-mono text-xs tabular-nums">{formatVnd(m.cost)}</td>
                    <td className="td-cell"><Badge label={m.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <TablePagination
            totalItems={maintenancesPg.totalItems}
            page={maintenancesPg.page}
            pageSize={maintenancesPg.pageSize}
            onPageChange={maintenancesPg.setPage}
            onPageSizeChange={maintenancesPg.setPageSize}
            unitLabel="phiếu bảo trì"
          />
        </div>
      )}

      {/* TAB 10: KIỂM KÊ & AUDIT LOG */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-sm font-semibold">Lịch sử kiểm kê ({inventoryPg.totalItems})</div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Đợt kiểm kê</th><th className="th-cell">Kết quả</th><th className="th-cell">Vị trí / Người dùng thực tế</th><th className="th-cell">Ghi chú</th><th className="th-cell">Người kiểm kê</th></tr></thead>
              <tbody>
                {inventoryPg.totalItems === 0 ? (
                  <tr><td colSpan={6} className="td-cell text-center text-ink-muted py-6">Chưa nằm trong đợt kiểm kê nào.</td></tr>
                ) : (
                  inventoryPg.paginated.map((it: any, idx: number) => (
                    <tr key={it.id}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{inventoryPg.startIndex + idx + 1}</td>
                      <td className="td-cell text-xs font-medium">{it.session?.sessionCode} — {it.session?.name}</td>
                      <td className="td-cell"><InventoryStatusBadge status={it.status} /></td>
                      <td className="td-cell text-xs">{it.actualLocation || '—'} / {it.actualUser || '—'}</td>
                      <td className="td-cell text-xs">{it.discrepancyNotes || it.actualCondition || '—'}</td>
                      <td className="td-cell text-xs">{it.checkedBy || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <TablePagination
              totalItems={inventoryPg.totalItems}
              page={inventoryPg.page}
              pageSize={inventoryPg.pageSize}
              onPageChange={inventoryPg.setPage}
              onPageSizeChange={inventoryPg.setPageSize}
              unitLabel="đợt kiểm kê"
            />
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-sm font-semibold">Nhật ký nghiệp vụ tài sản (Audit Log — {auditPg.totalItems})</div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th-cell w-12 text-center">STT</th><th className="th-cell">Thời điểm</th><th className="th-cell">Thao tác</th><th className="th-cell">Trước → Sau</th><th className="th-cell">Lý do</th><th className="th-cell">Người thực hiện</th></tr></thead>
              <tbody>
                {auditPg.totalItems === 0 ? (
                  <tr><td colSpan={6} className="td-cell text-center text-ink-muted py-6">Chưa có nhật ký nghiệp vụ.</td></tr>
                ) : (
                  auditPg.paginated.map((l: any, idx: number) => (
                    <tr key={l.id}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{auditPg.startIndex + idx + 1}</td>
                      <td className="td-cell text-xs">{formatDateTime(l.createdAt)}</td>
                      <td className="td-cell text-xs font-semibold text-ink-primary">{formatAuditAction(l.action)}</td>
                      <td className="td-cell text-xs">{l.oldValue ? `${l.oldValue} → ` : ''}{l.newValue || '—'}</td>
                      <td className="td-cell text-xs text-ink-secondary">{l.reason || '—'}</td>
                      <td className="td-cell text-xs">{l.actorName || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <TablePagination
              totalItems={auditPg.totalItems}
              page={auditPg.page}
              pageSize={auditPg.pageSize}
              onPageChange={auditPg.setPage}
              onPageSizeChange={auditPg.setPageSize}
              unitLabel="nhật ký"
            />
          </div>
        </div>
      )}

      {/* TAB 11: GHI CHÚ (REMOTE, KỸ THUẬT, LƯU Ý RIÊNG) */}
      {tab === 'notes' && (
        <div className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-semibold text-ink-primary">Ghi chú kỹ thuật & thông tin Remote</h2>
            </div>
            {can('assets.update') && (
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '+ UltraViewer', text: 'UltraViewer ID:  | Pass: ' },
                  { label: '+ AnyDesk', text: 'AnyDesk ID: ' },
                  { label: '+ RustDesk', text: 'RustDesk ID: ' },
                  { label: '+ IP / RDP', text: 'IP tĩnh / RDP: ' },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => appendNoteTemplate(tpl.text)}
                    className="px-2 py-0.5 rounded-full text-[11px] border border-sky-200 bg-sky-50/70 text-brand hover:bg-sky-100 font-medium"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveNotes} className="space-y-3">
            <textarea
              rows={10}
              value={notesDraft}
              disabled={!can('assets.update')}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="input-field font-mono text-xs leading-relaxed"
              placeholder="Ghi chú thông tin truy cập từ xa (UltraViewer, AnyDesk, RustDesk, RDP), IP tĩnh, cấu hình máy in, lưu ý bảo trì..."
            />
            {can('assets.update') && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-muted">
                  Mọi thay đổi ghi chú đều được lưu lịch sử trong tab Kiểm kê &amp; Audit.
                </span>
                <button type="submit" disabled={savingNotes} className="btn-primary">
                  <Save className="w-4 h-4" /> {savingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Audited Asset Code Edit Modal (SRS 7.3) */}
      <Modal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        title="Điều chỉnh mã tài sản chính thức"
        subtitle="Thao tác nhạy cảm: yêu cầu nhập lý do rõ ràng và sẽ được ghi vĩnh viễn vào Audit Log."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditCode} className="space-y-4">
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Mã hiện tại: <strong className="font-mono">{asset.assetCode}</strong>. Hệ thống sẽ kiểm tra tính duy nhất và giữ nguyên chính xác chuỗi bạn nhập.</span>
          </div>
          <div>
            <label className="label-field">Mã tài sản mới <span className="text-red-500">*</span></label>
            <input required value={newCode} onChange={(e) => setNewCode(e.target.value)} className="input-field font-mono" placeholder="Nhập mã tài sản mới" />
          </div>
          <div>
            <label className="label-field">Lý do điều chỉnh <span className="text-red-500">*</span></label>
            <textarea required rows={3} value={codeReason} onChange={(e) => setCodeReason(e.target.value)} className="input-field" placeholder="Nhập lý do điều chỉnh" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCodeModalOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Xác nhận đổi mã</button>
          </div>
        </form>
      </Modal>

      {/* QR Modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Tem nhãn mã QR tài sản" maxWidth="max-w-sm">
        {(() => {
          const qrUrl = `${window.location.origin}/qr/${encodeURIComponent(asset.assetCode)}`;
          return (
            <div className="text-center space-y-4">
              <AssetQrLabel asset={asset} config={qrConfig} />
              <div className="no-print text-[11px] text-ink-muted space-y-1">
                <div>Quét bằng camera điện thoại để xem ngay thẻ thông tin tài sản.</div>
                <a href={qrUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline font-medium inline-block">
                  Mở trang xem trước tem QR ↗
                </a>
              </div>
              <div className="no-print flex justify-center gap-2">
                <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" /> In tem QR</button>
                <button onClick={() => setQrOpen(false)} className="btn-secondary">Đóng</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Printable Handover / Transfer / Return Receipt Modal */}
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt ? `Biên bản chứng từ — ${receipt.code}` : 'Biên bản bàn giao / điều chuyển'}
        maxWidth="max-w-4xl"
      >
        {receipt && (
          <div className="space-y-4">
            <div className="no-print flex justify-end gap-2">
              <button type="button" onClick={() => window.print()} className="btn-primary">
                <Printer className="w-4 h-4" /> In biên bản / Lưu PDF
              </button>
              <button type="button" onClick={() => setReceipt(null)} className="btn-secondary">
                Đóng
              </button>
            </div>
            <HandoverReceipt data={receipt} />
          </div>
        )}
      </Modal>
    </div>
  );
};
