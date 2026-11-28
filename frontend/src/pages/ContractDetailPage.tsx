import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Upload,
  Download,
  Trash2,
  FileText,
  BellRing,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api, downloadAuthorizedFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import {
  CONTRACT_DOC_TYPES,
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  formatBytes,
  formatDate,
  formatDateTime,
  formatVnd,
} from '../utils/format';

export const ContractDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { confirm } = useDialog();
  const canManage = can('assets.update');
  const canDocs = can('assets.documents');

  const [contract, setContract] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    contractType: 'PURCHASE',
    supplierId: '',
    supplierName: '',
    contractValue: '',
    signedDate: '',
    startDate: '',
    endDate: '',
    remindDaysBefore: '30',
    autoRenew: false,
    status: 'ACTIVE',
    ownerName: '',
    departmentName: '',
    notes: '',
  });

  const [docType, setDocType] = useState('CONTRACT');
  const [docNotes, setDocNotes] = useState('');
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const syncForm = (d: any) => {
    setForm({
      title: d.title || '',
      contractType: d.contractType || 'PURCHASE',
      supplierId: d.supplierId || '',
      supplierName: d.supplierName || '',
      contractValue: d.contractValue != null ? String(d.contractValue) : '0',
      signedDate: d.signedDate ? new Date(d.signedDate).toISOString().slice(0, 10) : '',
      startDate: d.startDate ? new Date(d.startDate).toISOString().slice(0, 10) : '',
      endDate: d.endDate ? new Date(d.endDate).toISOString().slice(0, 10) : '',
      remindDaysBefore: String(d.remindDaysBefore ?? 30),
      autoRenew: Boolean(d.autoRenew),
      status: d.status || 'ACTIVE',
      ownerName: d.ownerName || '',
      departmentName: d.departmentName || '',
      notes: d.notes || '',
    });
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/contracts/${id}`);
      setContract(res.data);
      syncForm(res.data);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Không tải được chi tiết hợp đồng.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    Promise.allSettled([api.get('/admin/suppliers'), api.get('/admin/departments')]).then(([sRes, dRes]) => {
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
    });
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.patch(`/contracts/${id}`, {
        ...form,
        contractValue: form.contractValue ? Number(form.contractValue) : 0,
        remindDaysBefore: Math.max(1, Number(form.remindDaysBefore) || 30),
      });
      setContract(res.data);
      syncForm(res.data);
      setNotice({ type: 'success', text: 'Đã cập nhật thông tin hợp đồng.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Không thể cập nhật hợp đồng.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await confirm({
      title: 'Xóa hợp đồng',
      message: `Xác nhận xóa hợp đồng "${contract?.contractCode}"? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa hợp đồng',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/contracts/${id}`);
      navigate('/contracts');
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Không thể xóa hợp đồng.' });
    }
  };

  const handleUploadDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || docFiles.length === 0) return;
    setUploadingDoc(true);
    try {
      for (const file of docFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('docType', docType);
        fd.append('notes', docNotes);
        await api.post(`/contracts/${id}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      const count = docFiles.length;
      setDocFiles([]);
      setDocNotes('');
      await load();
      setNotice({ type: 'success', text: `Đã tải lên ${count} tệp hồ sơ hợp đồng.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Không thể tải lên tệp.' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id) return;
    const ok = await confirm({
      title: 'Xóa tệp đính kèm',
      message: 'Bạn có chắc chắn muốn xóa tệp đính kèm này khỏi hợp đồng?',
      confirmLabel: 'Xóa tệp',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/contracts/${id}/documents/${docId}`);
      await load();
      setNotice({ type: 'error', text: 'Đã xóa tệp đính kèm.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Không thể xóa tệp.' });
    }
  };

  if (loading) {
    return <div className="panel p-8 text-center text-sm text-ink-secondary">Đang tải thông tin hợp đồng...</div>;
  }

  if (!contract) {
    return (
      <div className="panel p-8 text-center space-y-3">
        <p className="text-sm text-ink-secondary">Không tìm thấy hợp đồng này.</p>
        <Link to="/contracts" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const tpMeta = CONTRACT_TYPE_META[contract.contractType] || CONTRACT_TYPE_META.PURCHASE;
  const stMeta = CONTRACT_STATUS_META[contract.effectiveStatus] || CONTRACT_STATUS_META.ACTIVE;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link to="/contracts" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách hợp đồng
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm sm:text-base font-bold px-2.5 py-0.5 rounded bg-ink-primary text-white">
              {contract.contractCode}
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-ink-primary">{contract.title}</h1>
            <Badge label={tpMeta.label} cls={tpMeta.cls} />
            <Badge label={stMeta.label} cls={stMeta.cls} />
          </div>
          <div className="text-xs text-ink-secondary mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>Nhà cung cấp: <strong>{contract.supplierName || '—'}</strong></span>
            <span>Giá trị: <strong className="font-mono text-brand">{formatVnd(contract.contractValue)}</strong></span>
            <span>Hết hạn: <strong>{contract.endDate ? formatDate(contract.endDate) : 'Không thời hạn'}</strong></span>
          </div>
        </div>

        {can('assets.delete') && (
          <button type="button" onClick={handleDelete} className="btn-danger text-xs self-start">
            <Trash2 className="w-3.5 h-3.5" /> Xóa hợp đồng
          </button>
        )}
      </div>

      {/* BANNER NHẮC HẸN */}
      {contract.isReminding && contract.daysRemaining != null && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 ${
            contract.daysRemaining < 0
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <BellRing className="w-4 h-4 shrink-0" />
          <span>
            {contract.daysRemaining < 0 ? (
              <>Hợp đồng này đã <strong>quá hạn {Math.abs(contract.daysRemaining)} ngày</strong> (ngày hết hạn: {formatDate(contract.endDate)}).</>
            ) : (
              <>Nhắc hẹn: Hợp đồng sẽ hết hạn sau <strong>{contract.daysRemaining} ngày</strong> (vào ngày {formatDate(contract.endDate)}, ngưỡng nhắc trước {contract.remindDaysBefore} ngày).</>
            )}
          </span>
        </div>
      )}

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

      {/* FORM THÔNG TIN HỢP ĐỒNG */}
      <form onSubmit={handleSave} className="panel p-4 sm:p-5 space-y-5">
        <div className="text-sm font-semibold text-ink-primary pb-2 border-b border-line">
          Thông tin chi tiết & Cấu hình nhắc hẹn
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="label-field">Tên / Nội dung hợp đồng</label>
            <input
              disabled={!canManage}
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Loại hợp đồng</label>
            <select
              disabled={!canManage}
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value })}
              className="input-field"
            >
              {Object.entries(CONTRACT_TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
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
            <label className="label-field">Giá trị hợp đồng (VND)</label>
            <CurrencyInput
              disabled={!canManage}
              value={form.contractValue}
              onChange={(raw) => setForm({ ...form, contractValue: raw })}
            />
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
              <option value="DRAFT">Bản nháp</option>
              <option value="EXPIRED">Đã hết hạn</option>
              <option value="TERMINATED">Đã thanh lý</option>
            </select>
          </div>
          <div>
            <label className="label-field">Ngày ký</label>
            <DateInputVN disabled={!canManage} value={form.signedDate} onChange={(iso) => setForm({ ...form, signedDate: iso })} />
          </div>
          <div>
            <label className="label-field">Ngày hiệu lực</label>
            <DateInputVN disabled={!canManage} value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} />
          </div>
          <div>
            <label className="label-field">Ngày hết hạn</label>
            <DateInputVN disabled={!canManage} value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} />
          </div>
          <div>
            <label className="label-field">Nhắc hẹn trước (số ngày)</label>
            <input
              disabled={!canManage}
              type="number"
              min={1}
              max={365}
              value={form.remindDaysBefore}
              onChange={(e) => setForm({ ...form, remindDaysBefore: e.target.value })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-field">Người phụ trách</label>
            <input
              disabled={!canManage}
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Phòng ban phụ trách</label>
            <select
              disabled={!canManage}
              value={form.departmentName}
              onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
              className="input-field"
            >
              <option value="">-- Chọn phòng ban --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
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
            <label className="label-field">Ghi chú / Điều khoản</label>
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
              {saving ? 'Đang lưu...' : 'Lưu cập nhật hợp đồng'}
            </button>
          </div>
        )}
      </form>

      {/* HỒ SƠ & TỆP ĐÍNH KÈM */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-semibold">
          Hồ sơ & Tệp hợp đồng đính kèm ({contract.documents?.length || 0})
        </div>

        {canDocs && (
          <form onSubmit={handleUploadDocs} className="p-4 bg-slate-50/80 border-b border-line space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label-field">Loại tệp</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field w-52">
                  {Object.entries(CONTRACT_DOC_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="label-field">Chọn nhiều tệp đính kèm</label>
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
              <div className="w-full sm:w-52">
                <label className="label-field">Ghi chú</label>
                <input value={docNotes} onChange={(e) => setDocNotes(e.target.value)} className="input-field" placeholder="Ghi chú tệp" />
              </div>
              <button type="submit" disabled={uploadingDoc || docFiles.length === 0} className="btn-primary">
                <Upload className="w-4 h-4" />
                {uploadingDoc ? 'Đang tải...' : `Tải lên${docFiles.length > 0 ? ` (${docFiles.length})` : ''}`}
              </button>
            </div>
            {docFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {docFiles.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-line text-xs">
                    <FileText className="w-3.5 h-3.5 text-brand" />
                    <span className="max-w-[180px] truncate">{f.name}</span>
                    <span className="text-[11px] font-mono text-ink-muted">({formatBytes(f.size)})</span>
                    <button type="button" onClick={() => setDocFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-ink-muted hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>
        )}

        <div className="divide-y divide-line">
          {!contract.documents || contract.documents.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Chưa có tệp hợp đồng đính kèm.</div>
          ) : (
            contract.documents.map((doc: any) => (
              <div key={doc.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={CONTRACT_DOC_TYPES[doc.docType] || doc.docType} cls="bg-indigo-50 text-indigo-700 border-indigo-200" />
                    <span className="text-xs font-medium text-ink-primary truncate">{doc.originalName}</span>
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {formatBytes(doc.sizeBytes)} • {doc.uploadedBy || '—'} • {formatDateTime(doc.createdAt)}
                    {doc.notes ? ` • ${doc.notes}` : ''}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadAuthorizedFile(`/contracts/documents/${doc.id}/download`, doc.originalName)}
                    className="btn-secondary px-2.5 py-1 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải về
                  </button>
                  {canDocs && (
                    <button type="button" onClick={() => handleDeleteDoc(doc.id)} className="btn-danger px-2 py-1 text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
