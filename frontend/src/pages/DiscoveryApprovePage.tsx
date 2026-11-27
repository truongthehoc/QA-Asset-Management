import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Upload,
  FileText,
  Trash2,
  Paperclip,
  AlertCircle,
  HardDrive,
  Building2,
  ShoppingCart,
  Cpu,
  ShieldAlert,
  Network,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useAssetStatuses } from '../contexts/AssetStatusContext';
import { PageHeader, Badge } from '../components/UiPrimitives';
import { DOC_TYPE_LABELS, formatBytes, formatDateTime } from '../utils/format';

interface PendingDoc {
  localId: string;
  file: File;
  docType: string;
  notes: string;
}

const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx';
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const QUICK_DOC_TYPES = [
  { key: 'PR', label: '+ Thêm file PR' },
  { key: 'PO', label: '+ Thêm file PO' },
  { key: 'HANDOVER', label: '+ Biên bản bàn giao' },
  { key: 'INVOICE', label: '+ Hóa đơn' },
  { key: 'CONTRACT', label: '+ Hợp đồng' },
  { key: 'WARRANTY', label: '+ Bảo hành' },
];

export const DiscoveryApprovePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeStatuses } = useAssetStatuses();

  const [device, setDevice] = useState<any>(null);
  const [meta, setMeta] = useState<any>({
    departments: [],
    assetTypes: [],
    locations: [],
    suppliers: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState('');

  const [form, setForm] = useState({
    assetCode: '',
    name: '',
    assetTypeId: '',
    status: 'IN_USE',
    serialNumber: '',
    manufacturer: '',
    model: '',
    hostname: '',
    managingDepartmentId: '',
    usingDepartmentId: '',
    assignedUserId: '',
    assignedUserName: '',
    locationId: '',
    locationDetail: '',
    handoverDate: new Date().toISOString().slice(0, 10),
    handoverBy: user?.fullName || '',
    receivedBy: '',
    notes: '',
    // Purchase & warranty
    purchaseDate: new Date().toISOString().slice(0, 10),
    inUseDate: new Date().toISOString().slice(0, 10),
    supplierId: '',
    contractNumber: '',
    invoiceNumber: '',
    purchasePrice: '',
    fundingSource: '',
    warrantyStartDate: new Date().toISOString().slice(0, 10),
    warrantyEndDate: '',
  });

  // Pending documents
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [defaultDocType, setDefaultDocType] = useState('PR');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocTypeRef = useRef<string>('PR');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/discovery/devices'), api.get('/admin/meta')])
      .then(([devRes, metaRes]) => {
        const list: any[] = devRes.data || [];
        const found = list.find((d) => d.id === id) || null;
        const m = metaRes.data || { departments: [], assetTypes: [], locations: [], suppliers: [] };
        setDevice(found);
        setMeta(m);

        if (found) {
          const defaultType = m.assetTypes.find((t: any) => t.code === 'PC') || m.assetTypes[0];
          const itDept = m.departments.find((d: any) => d.code === 'IT');
          const detectedHostname = (found.hostname || '').trim();
          setForm((prev) => ({
            ...prev,
            name: detectedHostname || `${found.manufacturer || ''} ${found.model || 'Thiết bị mới'}`.trim(),
            assetTypeId: defaultType?.id || '',
            serialNumber: found.serialNumber || '',
            manufacturer: found.manufacturer || found.macVendor || '',
            model: found.model || '',
            hostname: detectedHostname,
            managingDepartmentId: itDept?.id || '',
          }));
        }
      })
      .catch(() => {
        setErrorMsg('Không thể tải thông tin thiết bị chờ duyệt.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeStatuses.length > 0 && !activeStatuses.some((s) => s.code === form.status)) {
      setForm((f) => ({ ...f, status: activeStatuses[0].code }));
    }
  }, [activeStatuses]);

  const addFiles = (files: FileList | File[], docTypeOverride?: string) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    const rejected: string[] = [];
    const nextDocs: PendingDoc[] = [];

    for (const file of arr) {
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (vượt quá 15MB)`);
        continue;
      }
      nextDocs.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        docType: docTypeOverride || defaultDocType,
        notes: '',
      });
    }

    if (rejected.length > 0) {
      setErrorMsg(`Một số tệp không thể thêm: ${rejected.join(', ')}`);
    } else {
      setErrorMsg('');
    }

    if (nextDocs.length > 0) {
      setPendingDocs((prev) => [...prev, ...nextDocs]);
    }
  };

  const triggerQuickPick = (docType: string) => {
    pendingDocTypeRef.current = docType;
    setDefaultDocType(docType);
    fileInputRef.current?.click();
  };

  const updatePendingDoc = (localId: string, patch: Partial<Pick<PendingDoc, 'docType' | 'notes'>>) => {
    setPendingDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  };

  const removePendingDoc = (localId: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.localId !== localId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    setErrorMsg('');
    setSaving(true);
    setSaveStage('Đang phê duyệt và ghi nhận tài sản...');

    try {
      const manualCode = form.assetCode.trim();
      const res = await api.post(`/discovery/devices/${device.id}/approve`, {
        codeMode: manualCode ? 'MANUAL' : 'AUTO',
        assetCode: manualCode || undefined,
        name: form.name,
        assetTypeId: form.assetTypeId,
        status: form.status,
        serialNumber: form.serialNumber || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        hostname: form.hostname || undefined,
        managingDepartmentId: form.managingDepartmentId || undefined,
        usingDepartmentId: form.usingDepartmentId || undefined,
        assignedUserId: form.assignedUserId || undefined,
        assignedUserName: form.assignedUserName || undefined,
        locationId: form.locationId || undefined,
        locationDetail: form.locationDetail || undefined,
        handoverDate: form.handoverDate || undefined,
        handoverBy: form.handoverBy || undefined,
        receivedBy: form.receivedBy || form.assignedUserName || undefined,
        notes: form.notes || undefined,
        purchase: {
          purchaseDate: form.purchaseDate || undefined,
          inUseDate: form.inUseDate || undefined,
          supplierId: form.supplierId || undefined,
          contractNumber: form.contractNumber || undefined,
          invoiceNumber: form.invoiceNumber || undefined,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
          fundingSource: form.fundingSource || undefined,
          warrantyStartDate: form.warrantyStartDate || undefined,
          warrantyEndDate: form.warrantyEndDate || undefined,
        },
      });

      const createdAsset = res.data;

      if (pendingDocs.length > 0 && createdAsset?.id) {
        for (let i = 0; i < pendingDocs.length; i++) {
          const item = pendingDocs[i];
          setSaveStage(`Đang tải lên hồ sơ (${i + 1}/${pendingDocs.length}): ${item.file.name}...`);
          const fd = new FormData();
          fd.append('file', item.file);
          fd.append('docType', item.docType);
          fd.append('notes', item.notes);
          await api.post(`/assets/${createdAsset.id}/documents`, fd);
        }
      }

      navigate(createdAsset?.id ? `/assets/${createdAsset.id}` : '/discovery');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Không thể phê duyệt thiết bị. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSaving(false);
      setSaveStage('');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-ink-secondary">Đang tải thông tin thiết bị chờ duyệt...</div>;
  }

  if (!device) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="text-sm text-red-600">Không tìm thấy thiết bị chờ duyệt này.</div>
        <Link to="/discovery" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Quay lại Khám phá thiết bị
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <Link
          to="/discovery"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách khám phá thiết bị
        </Link>
        <PageHeader
          className="mb-0"
          title={`Duyệt ghi nhận tài sản chính thức — ${device.hostname || device.ipAddress || 'Thiết bị mới'}`}
          subtitle="Kiểm tra thông số thu thập tự động, bổ sung thông tin bàn giao, mua sắm, chứng từ đính kèm (PR, PO, Bàn giao...) và chốt Baseline v1."
          actions={
            <>
              <Link to="/discovery" className="btn-secondary">
                Hủy
              </Link>
              <button type="submit" form="approve-asset-form" disabled={saving} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                {saving ? saveStage || 'Đang duyệt...' : 'Phê duyệt & Ghi nhận tài sản'}
              </button>
            </>
          }
        />
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Auto-collected Hardware & Network Summary Banner */}
      <div className="panel p-4 bg-gradient-to-r from-[#eef8fc] via-white to-slate-50/70 border-sky-200/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Cpu className="w-4 h-4 text-brand" />
            <span className="text-sm font-semibold text-ink-primary">Thông tin tự động thu thập từ thiết bị</span>
            <Badge
              label={
                device.source === 'AGENT'
                  ? 'Windows Agent'
                  : device.source === 'BOTH'
                    ? 'Agent + LAN'
                    : 'LAN Discovery'
              }
              cls="bg-blue-50 text-blue-700 border-blue-200"
            />
            {device.approvalStatus === 'VERIFY_CONFLICT' && (
              <Badge label="Cần xác minh trùng" cls="bg-red-50 text-red-700 border-red-200" />
            )}
          </div>
          <span className="text-xs text-ink-muted">Phát hiện gần nhất: {formatDateTime(device.lastSeenAt)}</span>
        </div>

        {device.conflictReason && (
          <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{device.conflictReason}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-1">
          <div>
            <span className="text-ink-muted block">Hostname</span>
            <span className="font-mono font-semibold text-ink-primary">{device.hostname || '—'}</span>
          </div>
          <div>
            <span className="text-ink-muted block">IP / MAC</span>
            <span className="font-mono text-ink-primary inline-flex items-center gap-1">
              <Network className="w-3 h-3 text-brand shrink-0" />
              {device.ipAddress || '—'}
            </span>
            {device.macAddress && <div className="font-mono text-[11px] text-ink-muted">{device.macAddress}</div>}
          </div>
          <div>
            <span className="text-ink-muted block">Hãng / Model</span>
            <span className="font-medium text-ink-primary">
              {device.manufacturer || device.macVendor || '—'} {device.model || ''}
            </span>
          </div>
          <div>
            <span className="text-ink-muted block">Serial Number</span>
            <span className="font-mono text-ink-primary">{device.serialNumber || '—'}</span>
          </div>
          <div>
            <span className="text-ink-muted block">CPU / RAM</span>
            <span className="text-ink-primary font-medium truncate block" title={device.cpuSummary || ''}>
              {device.cpuSummary || '—'}
            </span>
            {device.ramTotalGb ? <span className="text-ink-muted">RAM: {device.ramTotalGb} GB</span> : null}
          </div>
          <div>
            <span className="text-ink-muted block">Hệ điều hành</span>
            <span className="text-ink-primary">{device.osName || '—'}</span>
          </div>
        </div>
      </div>

      <form id="approve-asset-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Định danh & Thông tin thiết bị */}
        <div className="panel p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-line">
            <HardDrive className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink-primary">1. Định danh & Thông tin thiết bị</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label-field">Mã tài sản</label>
              <input
                value={form.assetCode}
                onChange={(e) => setForm({ ...form, assetCode: e.target.value })}
                className="input-field font-mono"
                placeholder="Để trống hệ thống tự phát sinh"
              />
            </div>
            <div>
              <label className="label-field">
                Tên tài sản <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Nhập tên tài sản"
              />
            </div>
            <div>
              <label className="label-field">
                Loại tài sản <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.assetTypeId}
                onChange={(e) => setForm({ ...form, assetTypeId: e.target.value })}
                className="input-field"
              >
                {meta.assetTypes.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Trạng thái</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-field"
              >
                {activeStatuses.length > 0 ? (
                  activeStatuses.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="IN_USE">Đang sử dụng</option>
                    <option value="UNALLOCATED">Chưa phân bổ</option>
                    <option value="MAINTENANCE">Đang sửa chữa</option>
                    <option value="BROKEN">Hư hỏng</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="label-field">Hãng sản xuất</label>
              <input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="input-field"
                placeholder="Nhập hãng sản xuất"
              />
            </div>
            <div>
              <label className="label-field">Model</label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="input-field"
                placeholder="Nhập model thiết bị"
              />
            </div>
            <div>
              <label className="label-field">Serial Number</label>
              <input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="input-field font-mono"
                placeholder="Nhập số serial"
              />
            </div>
            <div>
              <label className="label-field">Hostname</label>
              <input
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                className="input-field font-mono"
                placeholder="Nhập hostname"
              />
            </div>
            <div>
              <label className="label-field">Ghi chú nội bộ</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                placeholder="Nhập ghi chú nội bộ"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Phân bổ, Vị trí & Bàn giao */}
        <div className="panel p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-line">
            <Building2 className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink-primary">2. Phân bổ, Vị trí & Bàn giao</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label-field">Phòng ban quản lý</label>
              <select
                value={form.managingDepartmentId}
                onChange={(e) => setForm({ ...form, managingDepartmentId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Mặc định / IT --</option>
                {meta.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Phòng ban sử dụng</label>
              <select
                value={form.usingDepartmentId}
                onChange={(e) => {
                  const nextDeptId = e.target.value;
                  const currentSelected = (meta.users || []).find((u: any) => u.id === form.assignedUserId);
                  const keepUser = currentSelected && (!nextDeptId || currentSelected.departmentId === nextDeptId);
                  setForm({
                    ...form,
                    usingDepartmentId: nextDeptId,
                    assignedUserId: keepUser ? form.assignedUserId : '',
                    assignedUserName: keepUser ? form.assignedUserName : '',
                  });
                }}
                className="input-field"
              >
                <option value="">-- Kho / Chưa phân bổ --</option>
                {meta.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Người sử dụng</label>
              {(() => {
                const deptUsers = (meta.users || []).filter(
                  (u: any) => !form.usingDepartmentId || u.departmentId === form.usingDepartmentId,
                );
                return (
                  <select
                    value={form.assignedUserId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const chosen = deptUsers.find((u: any) => u.id === uid);
                      setForm({
                        ...form,
                        assignedUserId: uid,
                        assignedUserName: chosen ? chosen.fullName : '',
                        receivedBy: form.receivedBy || (chosen ? chosen.fullName : ''),
                      });
                    }}
                    className="input-field"
                  >
                    <option value="">
                      {!form.usingDepartmentId
                        ? '-- Chọn người sử dụng --'
                        : deptUsers.length === 0
                          ? '-- Phòng ban chưa có người dùng --'
                          : `-- Chọn người dùng (${deptUsers.length}) --`}
                    </option>
                    {deptUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.username}){u.title ? ` — ${u.title}` : ''}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
            <div>
              <label className="label-field">Vị trí đặt thiết bị</label>
              <select
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn vị trí --</option>
                {meta.locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Chi tiết vị trí</label>
              <input
                value={form.locationDetail}
                onChange={(e) => setForm({ ...form, locationDetail: e.target.value })}
                className="input-field"
                placeholder="Nhập chi tiết vị trí"
              />
            </div>
            <div>
              <label className="label-field">Ngày bàn giao</label>
              <input
                type="date"
                value={form.handoverDate}
                onChange={(e) => setForm({ ...form, handoverDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Người bàn giao</label>
              <input
                value={form.handoverBy}
                onChange={(e) => setForm({ ...form, handoverBy: e.target.value })}
                className="input-field"
                placeholder="Nhập tên người bàn giao"
              />
            </div>
            <div>
              <label className="label-field">Người tiếp nhận</label>
              <input
                value={form.receivedBy}
                onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
                className="input-field"
                placeholder="Nhập tên người tiếp nhận"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Thông tin mua sắm & Bảo hành */}
        <div className="panel p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-line">
            <ShoppingCart className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-ink-primary">3. Thông tin mua sắm & Bảo hành</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label-field">Nhà cung cấp</label>
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {meta.suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Giá mua (VND)</label>
              <input
                type="number"
                min={0}
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                className="input-field tabular-nums"
                placeholder="Nhập giá mua"
              />
            </div>
            <div>
              <label className="label-field">Số hợp đồng / PO</label>
              <input
                value={form.contractNumber}
                onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className="input-field font-mono"
                placeholder="Nhập số hợp đồng / PO"
              />
            </div>
            <div>
              <label className="label-field">Số hóa đơn</label>
              <input
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                className="input-field font-mono"
                placeholder="Nhập số hóa đơn"
              />
            </div>
            <div>
              <label className="label-field">Nguồn kinh phí</label>
              <input
                value={form.fundingSource}
                onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                className="input-field"
                placeholder="Nhập nguồn kinh phí"
              />
            </div>
            <div>
              <label className="label-field">Ngày mua</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Bắt đầu bảo hành</label>
              <input
                type="date"
                value={form.warrantyStartDate}
                onChange={(e) => setForm({ ...form, warrantyStartDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Kết thúc bảo hành</label>
              <input
                type="date"
                value={form.warrantyEndDate}
                onChange={(e) => setForm({ ...form, warrantyEndDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Hồ sơ mua sắm & Chứng từ đính kèm */}
        <div className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-semibold text-ink-primary">
                4. Hồ sơ mua sắm & Chứng từ đính kèm ({pendingDocs.length})
              </h2>
            </div>
            <span className="text-xs text-ink-muted">
              Hỗ trợ PDF, Ảnh (PNG/JPG/WEBP), Word, Excel — tối đa 15MB/tệp
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-secondary font-medium mr-1">Chọn nhanh loại chứng từ:</span>
            {QUICK_DOC_TYPES.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => triggerQuickPick(q.key)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-sky-200 bg-sky-50/70 text-[#006E96] hover:bg-sky-100/80 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) {
                addFiles(e.dataTransfer.files);
              }
            }}
            className={`rounded-lg border-2 border-dashed p-5 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDragging
                ? 'border-brand bg-brand-soft/40'
                : 'border-slate-300 bg-slate-50/60 hover:border-brand/60'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-ink-primary">
                  Kéo thả nhiều tệp vào đây hoặc chọn từ máy tính
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  Có thể đính kèm cùng lúc PR, PO, Hóa đơn, Hợp đồng, Biên bản bàn giao...
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <select
                value={defaultDocType}
                onChange={(e) => {
                  setDefaultDocType(e.target.value);
                  pendingDocTypeRef.current = e.target.value;
                }}
                className="input-field w-52 text-xs py-1.5"
                title="Loại hồ sơ mặc định khi thêm tệp"
              >
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  pendingDocTypeRef.current = defaultDocType;
                  fileInputRef.current?.click();
                }}
                className="btn-secondary whitespace-nowrap"
              >
                <Upload className="w-4 h-4" /> Chọn tệp
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  addFiles(e.target.files, pendingDocTypeRef.current);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {pendingDocs.length > 0 && (
            <div className="border border-line rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th-cell w-12 text-center">STT</th>
                      <th className="th-cell">Tên tệp</th>
                      <th className="th-cell w-60">Loại hồ sơ</th>
                      <th className="th-cell">Ghi chú chứng từ</th>
                      <th className="th-cell w-24 text-right">Dung lượng</th>
                      <th className="th-cell w-16 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDocs.map((doc, idx) => (
                      <tr key={doc.localId}>
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="td-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-brand shrink-0" />
                            <span
                              className="text-xs font-medium text-ink-primary truncate max-w-[260px]"
                              title={doc.file.name}
                            >
                              {doc.file.name}
                            </span>
                          </div>
                        </td>
                        <td className="td-cell">
                          <select
                            value={doc.docType}
                            onChange={(e) => updatePendingDoc(doc.localId, { docType: e.target.value })}
                            className="input-field py-1 text-xs"
                          >
                            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="td-cell">
                          <input
                            value={doc.notes}
                            onChange={(e) => updatePendingDoc(doc.localId, { notes: e.target.value })}
                            className="input-field py-1 text-xs"
                            placeholder="Nhập ghi chú chứng từ"
                          />
                        </td>
                        <td className="td-cell text-right font-mono text-xs text-ink-secondary tabular-nums">
                          {formatBytes(doc.file.size)}
                        </td>
                        <td className="td-cell text-center">
                          <button
                            type="button"
                            onClick={() => removePendingDoc(doc.localId)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Gỡ tệp này"
                            aria-label="Gỡ tệp này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Link to="/discovery" className="btn-secondary">
            Hủy bỏ
          </Link>
          <button type="submit" disabled={saving} className="btn-primary px-5">
            <CheckCircle className="w-4 h-4" />
            {saving
              ? saveStage || 'Đang duyệt...'
              : `Phê duyệt & Ghi nhận tài sản${pendingDocs.length > 0 ? ` (${pendingDocs.length} hồ sơ)` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
};
