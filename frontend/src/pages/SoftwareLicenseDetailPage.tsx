import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  UserPlus,
  ArrowLeftRight,
  RotateCcw,
  Upload,
  Download,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  History,
  FileText,
  KeyRound,
  ArrowRight,
  X,
} from 'lucide-react';
import { api, downloadAuthorizedFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Badge, Modal } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import { TablePagination, usePagination } from '../components/TablePagination';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatVnd,
  LICENSE_DOC_TYPES,
  LICENSE_STATUS_META,
  LICENSE_TYPE_META,
} from '../utils/format';

const ALLOC_STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Đang sử dụng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TRANSFERRED: { label: 'Đã luân chuyển', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  REVOKED: { label: 'Đã thu hồi', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const HISTORY_ACTION_META: Record<string, { label: string; cls: string }> = {
  CREATED: { label: 'Khởi tạo bản quyền', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  UPDATED: { label: 'Cập nhật thông tin', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  RENEWED: { label: 'Gia hạn bản quyền', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  ALLOCATED: { label: 'Cấp phát bản quyền', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TRANSFERRED: { label: 'Luân chuyển bản quyền', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  REVOKED: { label: 'Thu hồi bản quyền', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  DOCUMENT_UPLOADED: { label: 'Tải lên chứng từ', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DOCUMENT_DELETED: { label: 'Xóa chứng từ', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export const SoftwareLicenseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { confirm } = useDialog();
  const canManage = can('assets.update');
  const canDocs = can('assets.documents');

  const [tab, setTab] = useState<'overview' | 'allocations' | 'documents' | 'history'>('overview');
  const [license, setLicense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reference catalogs for allocation/transfer
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  // Overview edit form
  const [form, setForm] = useState({
    name: '',
    publisher: '',
    version: '',
    licenseType: 'SUBSCRIPTION',
    licenseKey: '',
    totalSeats: '1',
    status: 'ACTIVE',
    supplierId: '',
    supplierName: '',
    contractNumber: '',
    invoiceNumber: '',
    purchasePrice: '',
    purchaseDate: '',
    activationDate: '',
    expirationDate: '',
    autoRenew: false,
    notes: '',
  });

  // Modals: Allocate, Transfer, Revoke
  const todayIso = new Date().toISOString().slice(0, 10);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({
    employeeId: '',
    departmentId: '',
    assetId: '',
    assignedAccount: '',
    seatCount: '1',
    allocatedDate: todayIso,
    activatedDate: todayIso,
    notes: '',
  });

  const [transferTarget, setTransferTarget] = useState<any>(null);
  const [transferForm, setTransferForm] = useState({
    employeeId: '',
    departmentId: '',
    assetId: '',
    assignedAccount: '',
    transferDate: todayIso,
    activatedDate: todayIso,
    reason: '',
    notes: '',
  });

  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const [revokeForm, setRevokeForm] = useState({ revokedDate: todayIso, reason: '' });

  // Document upload (multi-file)
  const [docType, setDocType] = useState('CONTRACT');
  const [docNotes, setDocNotes] = useState('');
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const showNotice = (type: 'success' | 'error', text: string) => setNotice({ type, text });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const syncForm = (data: any) => {
    setForm({
      name: data.name || '',
      publisher: data.publisher || '',
      version: data.version || '',
      licenseType: data.licenseType || 'SUBSCRIPTION',
      licenseKey: data.licenseKey || '',
      totalSeats: String(data.totalSeats || 1),
      status: data.status || 'ACTIVE',
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || '',
      contractNumber: data.contractNumber || '',
      invoiceNumber: data.invoiceNumber || '',
      purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : '0',
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString().slice(0, 10) : '',
      activationDate: data.activationDate ? new Date(data.activationDate).toISOString().slice(0, 10) : '',
      expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString().slice(0, 10) : '',
      autoRenew: Boolean(data.autoRenew),
      notes: data.notes || '',
    });
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/software/licenses/${id}`);
      setLicense(res.data);
      syncForm(res.data);
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không tải được hồ sơ bản quyền.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    Promise.allSettled([
      api.get('/admin/suppliers'),
      api.get('/admin/departments'),
      api.get('/admin/employees'),
      api.get('/assets'),
    ]).then(([sRes, dRes, eRes, aRes]) => {
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
      if (eRes.status === 'fulfilled') setEmployees((eRes.value.data || []).filter((e: any) => e.isActive !== false));
      if (aRes.status === 'fulfilled') setAssets((aRes.value.data || []).filter((a: any) => a.status !== 'DISPOSED'));
    });
  }, [id]);

  const allocationsPg = usePagination(license?.allocations || [], 10);
  const historiesPg = usePagination(license?.histories || [], 10);

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.patch(`/software/licenses/${id}`, {
        ...form,
        totalSeats: Math.max(1, Number(form.totalSeats) || 1),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
      });
      setLicense(res.data);
      syncForm(res.data);
      showNotice('success', 'Đã cập nhật thông tin bản quyền & hợp đồng.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể cập nhật bản quyền.');
    } finally {
      setSaving(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const res = await api.post(`/software/licenses/${id}/allocate`, {
        ...allocForm,
        seatCount: Math.max(1, Number(allocForm.seatCount) || 1),
      });
      setLicense(res.data);
      setAllocOpen(false);
      setAllocForm({
        employeeId: '',
        departmentId: '',
        assetId: '',
        assignedAccount: '',
        seatCount: '1',
        allocatedDate: todayIso,
        activatedDate: todayIso,
        notes: '',
      });
      setTab('allocations');
      showNotice('success', 'Đã cấp phát bản quyền phần mềm.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể cấp phát bản quyền.');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !transferTarget) return;
    try {
      const res = await api.post(`/software/licenses/${id}/allocations/${transferTarget.id}/transfer`, transferForm);
      setLicense(res.data);
      setTransferTarget(null);
      setTransferForm({
        employeeId: '',
        departmentId: '',
        assetId: '',
        assignedAccount: '',
        transferDate: todayIso,
        activatedDate: todayIso,
        reason: '',
        notes: '',
      });
      showNotice('success', 'Đã luân chuyển bản quyền sang đối tượng mới.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể luân chuyển bản quyền.');
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !revokeTarget) return;
    try {
      const res = await api.post(`/software/licenses/${id}/allocations/${revokeTarget.id}/revoke`, revokeForm);
      setLicense(res.data);
      setRevokeTarget(null);
      setRevokeForm({ revokedDate: todayIso, reason: '' });
      showNotice('error', 'Đã thu hồi suất bản quyền về kho.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể thu hồi bản quyền.');
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || docFiles.length === 0) return;
    setUploadingDoc(true);
    try {
      for (const file of docFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('docType', docType);
        fd.append('notes', docNotes);
        await api.post(`/software/licenses/${id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      const count = docFiles.length;
      setDocFiles([]);
      setDocNotes('');
      await load();
      showNotice('success', `Đã tải lên ${count} tệp chứng từ bản quyền.`);
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể tải lên tệp chứng từ.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Xóa chứng từ bản quyền',
      message: 'Bạn có chắc chắn muốn xóa chứng từ này khỏi hồ sơ bản quyền?',
      confirmLabel: 'Xóa chứng từ',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/software/licenses/${id}/documents/${docId}`);
      await load();
      showNotice('error', 'Đã xóa chứng từ.');
    } catch (err: any) {
      showNotice('error', err.response?.data?.message || 'Không thể xóa chứng từ.');
    }
  };

  if (loading) {
    return <div className="panel p-8 text-center text-sm text-ink-secondary">Đang tải hồ sơ bản quyền phần mềm...</div>;
  }

  if (!license) {
    return (
      <div className="panel p-8 text-center space-y-3">
        <p className="text-sm text-ink-secondary">Không tìm thấy hồ sơ bản quyền này.</p>
        <Link to="/software" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const stMeta = LICENSE_STATUS_META[license.effectiveStatus] || LICENSE_STATUS_META.ACTIVE;
  const tpMeta = LICENSE_TYPE_META[license.licenseType] || LICENSE_TYPE_META.SUBSCRIPTION;
  const seatPct = license.totalSeats > 0 ? Math.min(100, Math.round((license.usedSeats / license.totalSeats) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link to="/software" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách phần mềm & bản quyền
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm sm:text-base font-bold px-2.5 py-0.5 rounded bg-ink-primary text-white">
              {license.licenseCode}
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-ink-primary">{license.name}</h1>
            <Badge label={tpMeta.label} cls={tpMeta.cls} />
            <Badge label={stMeta.label} cls={stMeta.cls} />
          </div>
          <div className="text-xs text-ink-secondary mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Nhà phát hành: <strong>{license.publisher || '—'}</strong></span>
            <span>Hợp đồng: <strong className="font-mono">{license.contractNumber || '—'}</strong></span>
            <span>
              Hết hạn: <strong>{license.expirationDate ? formatDate(license.expirationDate) : 'Vĩnh viễn'}</strong>
              {license.daysRemaining != null && (
                <span className={license.daysRemaining < 0 ? ' text-red-600 font-semibold' : license.daysRemaining <= 30 ? ' text-amber-700 font-semibold' : ' text-emerald-700'}>
                  {' '}({license.daysRemaining < 0 ? `Quá hạn ${Math.abs(license.daysRemaining)} ngày` : `Còn ${license.daysRemaining} ngày`})
                </span>
              )}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={license.availableSeats <= 0}
              onClick={() => setAllocOpen(true)}
              className="btn-primary"
              title={license.availableSeats <= 0 ? 'Đã hết suất bản quyền khả dụng' : 'Cấp phát bản quyền'}
            >
              <UserPlus className="w-4 h-4" /> Cấp phát ({license.availableSeats} trống)
            </button>
          </div>
        )}
      </div>

      {/* SEAT USAGE BAR */}
      <div className="panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-ink-muted">Tình hình sử dụng bản quyền</div>
            <div className="text-sm font-semibold text-ink-primary tabular-nums">
              Đã cấp phát <span className="text-brand">{license.usedSeats}</span> / {license.totalSeats} suất · Còn trống{' '}
              <span className={license.availableSeats > 0 ? 'text-emerald-700' : 'text-red-600'}>{license.availableSeats}</span> suất
            </div>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <div className="flex justify-between text-[11px] text-ink-muted mb-1">
            <span>Tỷ lệ sử dụng</span>
            <span className="font-mono font-semibold">{seatPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${seatPct >= 95 ? 'bg-red-500' : seatPct >= 80 ? 'bg-amber-500' : 'bg-brand'}`}
              style={{ width: `${seatPct}%` }}
            />
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'overview' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          1. Tổng quan & Hợp đồng
        </button>
        <button
          onClick={() => setTab('allocations')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'allocations' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          2. Cấp phát / Luân chuyển / Thu hồi ({license.allocations?.length || 0})
        </button>
        <button
          onClick={() => setTab('documents')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'documents' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          3. Hợp đồng & Chứng từ ({license.documents?.length || 0})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'history' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          4. Lịch sử vòng đời ({license.histories?.length || 0})
        </button>
      </div>

      {/* TAB 1: TỔNG QUAN & HỢP ĐỒNG */}
      {tab === 'overview' && (
        <form onSubmit={handleSaveOverview} className="panel p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="label-field">Tên phần mềm / Gói bản quyền</label>
              <input
                disabled={!canManage}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Loại bản quyền</label>
              <select
                disabled={!canManage}
                value={form.licenseType}
                onChange={(e) => setForm({ ...form, licenseType: e.target.value })}
                className="input-field"
              >
                {Object.entries(LICENSE_TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Nhà phát hành</label>
              <input
                disabled={!canManage}
                value={form.publisher}
                onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Phiên bản / Gói</label>
              <input
                disabled={!canManage}
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Tổng số suất (Seats)</label>
              <input
                disabled={!canManage}
                type="number"
                min={1}
                value={form.totalSeats}
                onChange={(e) => setForm({ ...form, totalSeats: e.target.value })}
                className="input-field font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">License Key / Mã kích hoạt</label>
              <div className="relative">
                <input
                  disabled={!canManage}
                  type={showKey ? 'text' : 'password'}
                  value={form.licenseKey}
                  onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
                  className="input-field font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                  title={showKey ? 'Ẩn key' : 'Hiện key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-field">Trạng thái quản lý</label>
              <select
                disabled={!canManage}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-field"
              >
                <option value="ACTIVE">Đang hiệu lực</option>
                <option value="EXPIRED">Đã hết hạn</option>
                <option value="REVOKED">Đã thu hồi / Ngưng</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label-field">Ngày mua</label>
              <DateInputVN
                disabled={!canManage}
                value={form.purchaseDate}
                onChange={(iso) => setForm({ ...form, purchaseDate: iso })}
              />
            </div>
            <div>
              <label className="label-field">Ngày kích hoạt</label>
              <DateInputVN
                disabled={!canManage}
                value={form.activationDate}
                onChange={(iso) => setForm({ ...form, activationDate: iso })}
              />
            </div>
            <div>
              <label className="label-field">Ngày hết hạn (trống nếu vĩnh viễn)</label>
              <DateInputVN
                disabled={!canManage}
                value={form.expirationDate}
                onChange={(iso) => setForm({ ...form, expirationDate: iso })}
              />
            </div>
            <div>
              <label className="label-field">Nhà cung cấp</label>
              <select
                disabled={!canManage}
                value={form.supplierId}
                onChange={(e) => {
                  const sup = suppliers.find((s) => s.id === e.target.value);
                  setForm({ ...form, supplierId: e.target.value, supplierName: sup?.name || '' });
                }}
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
                disabled={!canManage}
                value={form.contractNumber}
                onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-field">Số hóa đơn</label>
              <input
                disabled={!canManage}
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-field">Chi phí mua (VND)</label>
              <CurrencyInput
                disabled={!canManage}
                value={form.purchasePrice}
                onChange={(raw) => setForm({ ...form, purchasePrice: raw })}
              />
            </div>
            <div className="sm:col-span-2 flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs text-ink-primary cursor-pointer select-none">
                <input
                  disabled={!canManage}
                  type="checkbox"
                  checked={form.autoRenew}
                  onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
                  className="rounded border-line text-brand focus:ring-brand"
                />
                <span>Tự động gia hạn khi đến kỳ hạn</span>
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label-field">Ghi chú hợp đồng / bản quyền</label>
              <textarea
                disabled={!canManage}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end pt-3 border-t border-line">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu thông tin bản quyền'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: CẤP PHÁT / LUÂN CHUYỂN / THU HỒI */}
      {tab === 'allocations' && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Danh sách suất bản quyền đã cấp phát ({allocationsPg.totalItems})</span>
            {canManage && (
              <button
                type="button"
                disabled={license.availableSeats <= 0}
                onClick={() => setAllocOpen(true)}
                className="btn-primary px-2.5 py-1.5 text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" /> Cấp phát suất mới
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Nhân viên / Phòng ban</th>
                  <th className="th-cell">Thiết bị / Tài khoản kích hoạt</th>
                  <th className="th-cell text-center">Suất</th>
                  <th className="th-cell">Ngày cấp / Kích hoạt</th>
                  <th className="th-cell">Trạng thái</th>
                  <th className="th-cell text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {allocationsPg.totalItems === 0 ? (
                  <tr>
                    <td colSpan={7} className="td-cell text-center text-ink-muted py-10">
                      Chưa cấp phát suất bản quyền nào.
                    </td>
                  </tr>
                ) : (
                  allocationsPg.paginated.map((a: any, idx: number) => {
                    const aMeta = ALLOC_STATUS_META[a.status] || ALLOC_STATUS_META.ACTIVE;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                          {allocationsPg.startIndex + idx + 1}
                        </td>
                        <td className="td-cell text-xs">
                          <div className="font-medium text-ink-primary">{a.employeeName || '—'}</div>
                          <div className="text-ink-muted">{a.departmentName || '—'}</div>
                        </td>
                        <td className="td-cell text-xs">
                          {a.assetId ? (
                            <Link to={`/assets/${a.assetId}`} className="font-mono font-semibold text-brand hover:underline block">
                              {a.assetCode} — {a.assetName}
                            </Link>
                          ) : (
                            <span className="text-ink-muted block">Không gắn thiết bị</span>
                          )}
                          {a.assignedAccount && (
                            <span className="font-mono text-[11px] text-ink-secondary">TK: {a.assignedAccount}</span>
                          )}
                        </td>
                        <td className="td-cell text-center font-mono text-xs font-semibold tabular-nums">{a.seatCount}</td>
                        <td className="td-cell text-xs">
                          <div>Cấp: {formatDate(a.allocatedDate)}</div>
                          <div className="text-[11px] text-ink-muted">
                            {a.status === 'ACTIVE'
                              ? `Kích hoạt: ${formatDate(a.activatedDate)}`
                              : `Kết thúc: ${formatDate(a.revokedDate)}`}
                          </div>
                        </td>
                        <td className="td-cell">
                          <Badge label={aMeta.label} cls={aMeta.cls} />
                          {a.revokeReason && (
                            <div className="text-[11px] text-ink-muted mt-0.5 max-w-[180px] truncate" title={a.revokeReason}>
                              {a.revokeReason}
                            </div>
                          )}
                        </td>
                        <td className="td-cell text-right">
                          {a.status === 'ACTIVE' && canManage && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTransferTarget(a)}
                                className="btn-secondary px-2 py-1 text-xs"
                                title="Luân chuyển sang người/máy khác"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" /> Luân chuyển
                              </button>
                              <button
                                type="button"
                                onClick={() => setRevokeTarget(a)}
                                className="btn-danger px-2 py-1 text-xs"
                                title="Thu hồi suất bản quyền về kho"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Thu hồi
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={allocationsPg.totalItems}
            page={allocationsPg.page}
            pageSize={allocationsPg.pageSize}
            onPageChange={allocationsPg.setPage}
            onPageSizeChange={allocationsPg.setPageSize}
            unitLabel="suất cấp phát"
          />
        </div>
      )}

      {/* TAB 3: HỢP ĐỒNG & CHỨNG TỪ */}
      {tab === 'documents' && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Hợp đồng, Hóa đơn & Chứng nhận bản quyền ({license.documents?.length || 0})</span>
          </div>

          {canDocs && (
            <form onSubmit={handleUploadDoc} className="p-4 bg-slate-50/80 border-b border-line space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label-field">Loại chứng từ</label>
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field w-52">
                    {Object.entries(LICENSE_DOC_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="label-field">Chọn nhiều tệp đính kèm (PDF, ảnh, Word, Excel...)</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      if (picked.length > 0) setDocFiles((prev) => [...prev, ...picked]);
                      e.target.value = '';
                    }}
                    className="input-field py-1.5 text-xs"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <label className="label-field">Ghi chú</label>
                  <input
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    className="input-field"
                    placeholder="Ghi chú chứng từ"
                  />
                </div>
                <button type="submit" disabled={uploadingDoc || docFiles.length === 0} className="btn-primary">
                  <Upload className="w-4 h-4" />
                  {uploadingDoc ? 'Đang tải lên...' : `Tải lên${docFiles.length > 0 ? ` (${docFiles.length} tệp)` : ''}`}
                </button>
              </div>

              {docFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {docFiles.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-line text-xs text-ink-primary"
                    >
                      <FileText className="w-3.5 h-3.5 text-brand" />
                      <span className="max-w-[200px] truncate">{f.name}</span>
                      <span className="text-[11px] font-mono text-ink-muted">({formatBytes(f.size)})</span>
                      <button
                        type="button"
                        onClick={() => setDocFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-ink-muted hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Loại chứng từ</th>
                  <th className="th-cell">Tên tệp</th>
                  <th className="th-cell">Dung lượng</th>
                  <th className="th-cell">Người tải / Ngày tải</th>
                  <th className="th-cell text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!license.documents || license.documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="td-cell text-center text-ink-muted py-10">
                      Chưa có tệp hợp đồng hoặc chứng từ đính kèm.
                    </td>
                  </tr>
                ) : (
                  license.documents.map((doc: any, idx: number) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted">{idx + 1}</td>
                      <td className="td-cell">
                        <Badge label={LICENSE_DOC_TYPES[doc.docType] || doc.docType} cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                      </td>
                      <td className="td-cell text-xs">
                        <div className="font-medium text-ink-primary flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-brand shrink-0" />
                          <span>{doc.originalName}</span>
                        </div>
                        {doc.notes && <div className="text-[11px] text-ink-muted mt-0.5">{doc.notes}</div>}
                      </td>
                      <td className="td-cell font-mono text-xs text-ink-secondary">{formatBytes(doc.sizeBytes)}</td>
                      <td className="td-cell text-xs">
                        <div>{doc.uploadedBy || '—'}</div>
                        <div className="text-[11px] text-ink-muted">{formatDateTime(doc.createdAt)}</div>
                      </td>
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => downloadAuthorizedFile(`/software/licenses/documents/${doc.id}/download`, doc.originalName)}
                            className="btn-secondary px-2 py-1 text-xs"
                          >
                            <Download className="w-3.5 h-3.5" /> Tải về
                          </button>
                          {canDocs && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="btn-danger px-2 py-1 text-xs"
                            >
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
        </div>
      )}

      {/* TAB 4: LỊCH SỬ VÒNG ĐỜI */}
      {tab === 'history' && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2 text-sm font-semibold">
            <History className="w-4 h-4 text-brand" />
            <span>Nhật ký cấp phát, luân chuyển, thu hồi & cập nhật ({historiesPg.totalItems})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Thời điểm</th>
                  <th className="th-cell">Nghiệp vụ</th>
                  <th className="th-cell">Từ → Sang</th>
                  <th className="th-cell">Nội dung / Lý do</th>
                  <th className="th-cell">Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {historiesPg.totalItems === 0 ? (
                  <tr>
                    <td colSpan={6} className="td-cell text-center text-ink-muted py-10">
                      Chưa có nhật ký lịch sử.
                    </td>
                  </tr>
                ) : (
                  historiesPg.paginated.map((h: any, idx: number) => {
                    const hMeta = HISTORY_ACTION_META[h.action] || {
                      label: h.action,
                      cls: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="td-cell text-center font-mono text-xs text-ink-muted">
                          {historiesPg.startIndex + idx + 1}
                        </td>
                        <td className="td-cell font-mono text-xs whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                        <td className="td-cell"><Badge label={hMeta.label} cls={hMeta.cls} /></td>
                        <td className="td-cell text-xs">
                          {h.fromTarget || h.toTarget ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {h.fromTarget && <span className="text-ink-secondary">{h.fromTarget}</span>}
                              {h.fromTarget && h.toTarget && <ArrowRight className="w-3 h-3 text-ink-muted" />}
                              {h.toTarget && <span className="font-medium text-ink-primary">{h.toTarget}</span>}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="td-cell text-xs">
                          <div className="text-ink-primary">{h.note || '—'}</div>
                          {h.reason && <div className="text-[11px] text-ink-muted">Lý do: {h.reason}</div>}
                        </td>
                        <td className="td-cell text-xs">{h.actorName || 'Hệ thống'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={historiesPg.totalItems}
            page={historiesPg.page}
            pageSize={historiesPg.pageSize}
            onPageChange={historiesPg.setPage}
            onPageSizeChange={historiesPg.setPageSize}
            unitLabel="nhật ký"
          />
        </div>
      )}

      {/* MODAL: CẤP PHÁT BẢN QUYỀN */}
      <Modal open={allocOpen} onClose={() => setAllocOpen(false)} title="Cấp phát bản quyền phần mềm" maxWidth="max-w-lg">
        <form onSubmit={handleAllocate} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Nhân viên sử dụng</label>
              <select
                value={allocForm.employeeId}
                onChange={(e) => {
                  const emp = employees.find((x) => x.id === e.target.value);
                  setAllocForm({
                    ...allocForm,
                    employeeId: e.target.value,
                    departmentId: emp?.departmentId || allocForm.departmentId,
                  });
                }}
                className="input-field"
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Phòng ban</label>
              <select
                value={allocForm.departmentId}
                onChange={(e) => setAllocForm({ ...allocForm, departmentId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Tài sản / Máy tính cài đặt</label>
              <select
                value={allocForm.assetId}
                onChange={(e) => setAllocForm({ ...allocForm, assetId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn tài sản (tuỳ chọn) --</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Tài khoản / Email kích hoạt</label>
              <input
                value={allocForm.assignedAccount}
                onChange={(e) => setAllocForm({ ...allocForm, assignedAccount: e.target.value })}
                className="input-field"
                placeholder="Email hoặc tài khoản đăng nhập"
              />
            </div>
            <div>
              <label className="label-field">Số suất cấp (Còn trống: {license.availableSeats})</label>
              <input
                type="number"
                min={1}
                max={Math.max(1, license.availableSeats)}
                value={allocForm.seatCount}
                onChange={(e) => setAllocForm({ ...allocForm, seatCount: e.target.value })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-field">Ngày cấp phát</label>
              <DateInputVN value={allocForm.allocatedDate} onChange={(iso) => setAllocForm({ ...allocForm, allocatedDate: iso })} />
            </div>
            <div>
              <label className="label-field">Ngày kích hoạt</label>
              <DateInputVN value={allocForm.activatedDate} onChange={(iso) => setAllocForm({ ...allocForm, activatedDate: iso })} />
            </div>
          </div>
          <div>
            <label className="label-field">Ghi chú</label>
            <textarea
              rows={2}
              value={allocForm.notes}
              onChange={(e) => setAllocForm({ ...allocForm, notes: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setAllocOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Xác nhận cấp phát</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: LUÂN CHUYỂN BẢN QUYỀN */}
      <Modal
        open={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        title="Luân chuyển bản quyền phần mềm"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleTransfer} className="space-y-3.5">
          {transferTarget && (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
              Đang sử dụng bởi: <strong>{transferTarget.employeeName || transferTarget.departmentName || transferTarget.assetCode || '—'}</strong> ({transferTarget.seatCount} suất)
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Nhân viên nhận mới</label>
              <select
                value={transferForm.employeeId}
                onChange={(e) => {
                  const emp = employees.find((x) => x.id === e.target.value);
                  setTransferForm({
                    ...transferForm,
                    employeeId: e.target.value,
                    departmentId: emp?.departmentId || transferForm.departmentId,
                  });
                }}
                className="input-field"
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Phòng ban mới</label>
              <select
                value={transferForm.departmentId}
                onChange={(e) => setTransferForm({ ...transferForm, departmentId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Tài sản / Máy tính mới</label>
              <select
                value={transferForm.assetId}
                onChange={(e) => setTransferForm({ ...transferForm, assetId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn tài sản (tuỳ chọn) --</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Tài khoản kích hoạt mới</label>
              <input
                value={transferForm.assignedAccount}
                onChange={(e) => setTransferForm({ ...transferForm, assignedAccount: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Ngày luân chuyển</label>
              <DateInputVN value={transferForm.transferDate} onChange={(iso) => setTransferForm({ ...transferForm, transferDate: iso })} />
            </div>
          </div>
          <div>
            <label className="label-field">Lý do luân chuyển</label>
            <input
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              className="input-field"
              placeholder="Điều chuyển nhân sự, đổi máy tính..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setTransferTarget(null)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Xác nhận luân chuyển</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: THU HỒI BẢN QUYỀN */}
      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Thu hồi suất bản quyền về kho"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRevoke} className="space-y-3.5">
          {revokeTarget && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-900">
              Thu hồi <strong>{revokeTarget.seatCount} suất</strong> từ{' '}
              <strong>{revokeTarget.employeeName || revokeTarget.departmentName || revokeTarget.assetCode || '—'}</strong>.
            </div>
          )}
          <div>
            <label className="label-field">Ngày thu hồi</label>
            <DateInputVN value={revokeForm.revokedDate} onChange={(iso) => setRevokeForm({ ...revokeForm, revokedDate: iso })} />
          </div>
          <div>
            <label className="label-field">Lý do thu hồi <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={2}
              value={revokeForm.reason}
              onChange={(e) => setRevokeForm({ ...revokeForm, reason: e.target.value })}
              className="input-field"
              placeholder="Nhân sự nghỉ việc, không còn nhu cầu sử dụng..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setRevokeTarget(null)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-danger">Xác nhận thu hồi</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
