import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Infinity as InfinityIcon,
  Layers,
  Cpu,
  Share2,
  KeyRound,
  Save,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileText,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import { formatBytes, formatVnd, LICENSE_DOC_TYPES, LICENSE_TYPE_META } from '../utils/format';

const TYPE_CARDS = [
  {
    key: 'SUBSCRIPTION',
    icon: CalendarClock,
    idleCls: 'bg-sky-50/45 border-sky-200/80 hover:bg-sky-50/80 hover:border-sky-300',
    activeCls: 'bg-sky-50 border-sky-500 ring-1 ring-sky-500/30 shadow-sm',
    iconWrap: 'bg-sky-100/80 text-sky-700',
    titleCls: 'text-sky-900',
  },
  {
    key: 'PERPETUAL',
    icon: InfinityIcon,
    idleCls: 'bg-emerald-50/45 border-emerald-200/80 hover:bg-emerald-50/80 hover:border-emerald-300',
    activeCls: 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30 shadow-sm',
    iconWrap: 'bg-emerald-100/80 text-emerald-700',
    titleCls: 'text-emerald-900',
  },
  {
    key: 'VOLUME',
    icon: Layers,
    idleCls: 'bg-indigo-50/45 border-indigo-200/80 hover:bg-indigo-50/80 hover:border-indigo-300',
    activeCls: 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500/30 shadow-sm',
    iconWrap: 'bg-indigo-100/80 text-indigo-700',
    titleCls: 'text-indigo-900',
  },
  {
    key: 'OEM',
    icon: Cpu,
    idleCls: 'bg-amber-50/45 border-amber-200/80 hover:bg-amber-50/80 hover:border-amber-300',
    activeCls: 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30 shadow-sm',
    iconWrap: 'bg-amber-100/80 text-amber-700',
    titleCls: 'text-amber-900',
  },
  {
    key: 'FLOATING',
    icon: Share2,
    idleCls: 'bg-violet-50/45 border-violet-200/80 hover:bg-violet-50/80 hover:border-violet-300',
    activeCls: 'bg-violet-50 border-violet-500 ring-1 ring-violet-500/30 shadow-sm',
    iconWrap: 'bg-violet-100/80 text-violet-700',
    titleCls: 'text-violet-900',
  },
] as const;

export const SoftwareLicenseCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [defaultDocType, setDefaultDocType] = useState('CONTRACT');
  const [attachments, setAttachments] = useState<Array<{ file: File; docType: string }>>([]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    licenseType: 'SUBSCRIPTION',
    licenseCode: '',
    name: '',
    publisher: '',
    version: '',
    totalSeats: '1',
    licenseKey: '',
    supplierId: '',
    supplierName: '',
    contractNumber: '',
    invoiceNumber: '',
    purchasePrice: '',
    purchaseDate: todayIso,
    activationDate: todayIso,
    expirationDate: '',
    autoRenew: false,
    notes: '',
  });

  useEffect(() => {
    api
      .get('/admin/suppliers')
      .then((res) => setSuppliers(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Vui lòng nhập tên phần mềm / gói bản quyền.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/software/licenses', {
        ...form,
        totalSeats: Math.max(1, Number(form.totalSeats) || 1),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
      });
      const createdId = res.data.id;
      for (const att of attachments) {
        const fd = new FormData();
        fd.append('file', att.file);
        fd.append('docType', att.docType);
        await api.post(`/software/licenses/${createdId}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigate(`/software/licenses/${createdId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tạo hồ sơ bản quyền phần mềm.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeMeta = LICENSE_TYPE_META[form.licenseType] || LICENSE_TYPE_META.SUBSCRIPTION;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/software" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách phần mềm & bản quyền
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">Thêm mới bản quyền phần mềm (License)</h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Quản lý ngày mua, kích hoạt, hết hạn, hợp đồng và cấp phát / luân chuyển / thu hồi theo từng suất sử dụng.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Loại bản quyền */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">1. Hình thức / Loại bản quyền</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TYPE_CARDS.map(({ key, icon: Icon, idleCls, activeCls, iconWrap, titleCls }) => {
                const meta = LICENSE_TYPE_META[key];
                const active = form.licenseType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, licenseType: key }))}
                    className={`text-left p-3 rounded-lg border transition-all ${active ? activeCls : idleCls}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconWrap}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className={`text-xs sm:text-sm font-semibold ${titleCls}`}>{meta.label}</span>
                    </div>
                    <p className="text-[11px] text-ink-secondary mt-1.5 leading-relaxed">{meta.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Thông tin phần mềm */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">2. Thông tin phần mềm & Key bản quyền</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="label-field">
                  Tên phần mềm / Gói bản quyền <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="Nhập tên phần mềm hoặc gói license"
                />
              </div>
              <div>
                <label className="label-field">Mã bản quyền (để trống để tự sinh)</label>
                <input
                  value={form.licenseCode}
                  onChange={(e) => setForm({ ...form, licenseCode: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Tự động sinh mã LIC-..."
                />
              </div>
              <div>
                <label className="label-field">Tổng số suất (Seats) <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.totalSeats}
                  onChange={(e) => setForm({ ...form, totalSeats: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
              <div>
                <label className="label-field">Nhà phát hành</label>
                <input
                  value={form.publisher}
                  onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                  className="input-field"
                  placeholder="Microsoft, Adobe, Autodesk, Kaspersky..."
                />
              </div>
              <div>
                <label className="label-field">Phiên bản / Gói</label>
                <input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  className="input-field"
                  placeholder="Business Standard, Pro, 2026..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">License Key / Mã kích hoạt / Tài khoản quản trị</label>
                <input
                  value={form.licenseKey}
                  onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập mã key hoặc thông tin cổng quản trị bản quyền"
                />
              </div>
            </div>
          </div>

          {/* 3. Thời hạn & Hợp đồng mua sắm */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">3. Thời hạn hiệu lực & Hợp đồng mua sắm</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="label-field">Ngày mua</label>
                <DateInputVN
                  value={form.purchaseDate}
                  onChange={(iso) => setForm({ ...form, purchaseDate: iso })}
                />
              </div>
              <div>
                <label className="label-field">Ngày kích hoạt</label>
                <DateInputVN
                  value={form.activationDate}
                  onChange={(iso) => setForm({ ...form, activationDate: iso })}
                />
              </div>
              <div>
                <label className="label-field">Ngày hết hạn (trống nếu vĩnh viễn)</label>
                <DateInputVN
                  value={form.expirationDate}
                  onChange={(iso) => setForm({ ...form, expirationDate: iso })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Nhà cung cấp</label>
                <select
                  value={form.supplierId}
                  onChange={(e) => {
                    const sup = suppliers.find((s) => s.id === e.target.value);
                    setForm({ ...form, supplierId: e.target.value, supplierName: sup?.name || '' });
                  }}
                  className="input-field"
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Chi phí mua (VND)</label>
                <CurrencyInput
                  value={form.purchasePrice}
                  onChange={(raw) => setForm({ ...form, purchasePrice: raw })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-field">Số hợp đồng</label>
                <input
                  value={form.contractNumber}
                  onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập số hợp đồng mua bản quyền"
                />
              </div>
              <div>
                <label className="label-field">Số hóa đơn</label>
                <input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập số hóa đơn VAT"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-ink-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.autoRenew}
                    onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
                    className="rounded border-line text-brand focus:ring-brand"
                  />
                  <span>Tự động gia hạn khi đến kỳ hạn</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Ghi chú hợp đồng / điều khoản sử dụng</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field"
                  placeholder="Ghi chú phạm vi sử dụng, điều khoản gia hạn..."
                />
              </div>
            </div>
          </div>

          {/* 4. Hợp đồng & Tệp chứng từ đính kèm (nhiều file) */}
          <div className="panel p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink-primary">
                4. Hợp đồng & Chứng từ đính kèm ({attachments.length} tệp)
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={defaultDocType}
                  onChange={(e) => setDefaultDocType(e.target.value)}
                  className="input-field py-1.5 text-xs w-48"
                >
                  {Object.entries(LICENSE_DOC_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <label className="btn-secondary px-3 py-1.5 text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Chọn nhiều tệp
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setAttachments((prev) => [
                          ...prev,
                          ...files.map((file) => ({ file, docType: defaultDocType })),
                        ]);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-line bg-slate-50/60 text-center text-xs text-ink-muted">
                Có thể chọn nhiều tệp cùng lúc (Hợp đồng PDF, Hóa đơn VAT, Chứng nhận bản quyền, ảnh chụp...).
              </div>
            ) : (
              <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
                {attachments.map((att, idx) => (
                  <div key={`${att.file.name}-${idx}`} className="px-3 py-2 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-brand shrink-0" />
                      <span className="font-medium text-ink-primary truncate">{att.file.name}</span>
                      <span className="font-mono text-[11px] text-ink-muted shrink-0">({formatBytes(att.file.size)})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={att.docType}
                        onChange={(e) =>
                          setAttachments((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, docType: e.target.value } : item)),
                          )
                        }
                        className="input-field py-1 text-xs w-44"
                      >
                        {Object.entries(LICENSE_DOC_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-ink-muted hover:text-red-600 rounded"
                        title="Bỏ tệp này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: TÓM TẮT */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <KeyRound className="w-4 h-4 text-brand" />
              <span className="text-sm font-semibold text-ink-primary">Tóm tắt hồ sơ bản quyền</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Loại bản quyền</span>
                <Badge label={typeMeta.label} cls={typeMeta.cls} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Tên phần mềm</span>
                <span className="font-medium text-ink-primary truncate max-w-[60%]">{form.name.trim() || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Tổng số suất</span>
                <span className="font-mono font-semibold text-ink-primary">{form.totalSeats || 1} suất</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Số hợp đồng</span>
                <span className="font-mono text-ink-primary">{form.contractNumber.trim() || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="text-ink-muted">Tổng chi phí</span>
                <span className="font-mono text-sm font-bold text-brand tabular-nums">
                  {formatVnd(form.purchasePrice ? Number(form.purchasePrice) : 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50/80 border border-sky-200 text-xs text-sky-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                Quản lý trọn vòng đời
              </div>
              <p className="text-[11px] leading-relaxed text-sky-800">
                Sau khi tạo hồ sơ, bạn có thể đính kèm file Hợp đồng/Hóa đơn PDF và thực hiện <strong>Cấp phát, Luân chuyển, Thu hồi</strong> từng suất bản quyền.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
                <Save className="w-4 h-4" />
                {submitting ? 'Đang lưu...' : 'Tạo hồ sơ bản quyền'}
              </button>
              <Link to="/software" className="btn-secondary w-full justify-center">
                Hủy bỏ
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
