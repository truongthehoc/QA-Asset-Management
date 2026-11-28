import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Wrench,
  KeyRound,
  Repeat,
  FileText,
  Save,
  AlertCircle,
  BellRing,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import {
  CONTRACT_DOC_TYPES,
  CONTRACT_TYPE_META,
  formatBytes,
  formatVnd,
} from '../utils/format';

const TYPE_CARDS = [
  {
    key: 'PURCHASE',
    icon: ShoppingCart,
    idleCls: 'bg-sky-50/45 border-sky-200/80 hover:bg-sky-50/80 hover:border-sky-300',
    activeCls: 'bg-sky-50 border-sky-500 ring-1 ring-sky-500/30 shadow-sm',
    iconWrap: 'bg-sky-100/80 text-sky-700',
    titleCls: 'text-sky-900',
  },
  {
    key: 'MAINTENANCE',
    icon: Wrench,
    idleCls: 'bg-amber-50/45 border-amber-200/80 hover:bg-amber-50/80 hover:border-amber-300',
    activeCls: 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30 shadow-sm',
    iconWrap: 'bg-amber-100/80 text-amber-700',
    titleCls: 'text-amber-900',
  },
  {
    key: 'LICENSE',
    icon: KeyRound,
    idleCls: 'bg-violet-50/45 border-violet-200/80 hover:bg-violet-50/80 hover:border-violet-300',
    activeCls: 'bg-violet-50 border-violet-500 ring-1 ring-violet-500/30 shadow-sm',
    iconWrap: 'bg-violet-100/80 text-violet-700',
    titleCls: 'text-violet-900',
  },
  {
    key: 'RENTAL',
    icon: Repeat,
    idleCls: 'bg-teal-50/45 border-teal-200/80 hover:bg-teal-50/80 hover:border-teal-300',
    activeCls: 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/30 shadow-sm',
    iconWrap: 'bg-teal-100/80 text-teal-700',
    titleCls: 'text-teal-900',
  },
  {
    key: 'OTHER',
    icon: FileText,
    idleCls: 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300',
    activeCls: 'bg-slate-100 border-slate-500 ring-1 ring-slate-500/30 shadow-sm',
    iconWrap: 'bg-slate-200/80 text-slate-700',
    titleCls: 'text-slate-900',
  },
] as const;

export const ContractCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [defaultDocType, setDefaultDocType] = useState('CONTRACT');
  const [attachments, setAttachments] = useState<Array<{ file: File; docType: string }>>([]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    contractType: 'PURCHASE',
    contractCode: '',
    title: '',
    supplierId: '',
    supplierName: '',
    contractValue: '',
    signedDate: todayIso,
    startDate: todayIso,
    endDate: '',
    remindDaysBefore: '30',
    autoRenew: false,
    status: 'ACTIVE',
    ownerName: user?.fullName || '',
    departmentName: user?.departmentName || '',
    notes: '',
  });

  useEffect(() => {
    Promise.allSettled([api.get('/admin/suppliers'), api.get('/admin/departments')]).then(([sRes, dRes]) => {
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
    });
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Vui lòng nhập tên / nội dung hợp đồng.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/contracts', {
        ...form,
        contractValue: form.contractValue ? Number(form.contractValue) : 0,
        remindDaysBefore: Math.max(1, Number(form.remindDaysBefore) || 30),
      });
      const createdId = res.data.id;
      for (const att of attachments) {
        const fd = new FormData();
        fd.append('file', att.file);
        fd.append('docType', att.docType);
        await api.post(`/contracts/${createdId}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigate(`/contracts/${createdId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tạo hợp đồng mới.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeMeta = CONTRACT_TYPE_META[form.contractType] || CONTRACT_TYPE_META.PURCHASE;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/contracts" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách hợp đồng
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">Thêm hợp đồng mới</h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Gán hợp đồng với nhà cung cấp, thiết lập số ngày nhắc hẹn tự động trước khi hết hạn và đính kèm chứng từ.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Loại hợp đồng */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">1. Loại hợp đồng</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TYPE_CARDS.map(({ key, icon: Icon, idleCls, activeCls, iconWrap, titleCls }) => {
                const meta = CONTRACT_TYPE_META[key];
                const active = form.contractType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, contractType: key }))}
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

          {/* 2. Thông tin chung & Nhà cung cấp */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">2. Thông tin hợp đồng & Nhà cung cấp</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="label-field">
                  Tên / Nội dung hợp đồng <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-field"
                  placeholder="Nhập tên hoặc nội dung tóm tắt của hợp đồng"
                />
              </div>
              <div>
                <label className="label-field">Số hợp đồng (để trống để tự sinh)</label>
                <input
                  value={form.contractCode}
                  onChange={(e) => setForm({ ...form, contractCode: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Tự động sinh mã HD-..."
                />
              </div>
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
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Giá trị hợp đồng (VND)</label>
                <CurrencyInput
                  value={form.contractValue}
                  onChange={(raw) => setForm({ ...form, contractValue: raw })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-field">Trạng thái hợp đồng</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-field"
                >
                  <option value="ACTIVE">Đang hiệu lực</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="TERMINATED">Đã thanh lý</option>
                </select>
              </div>
              <div>
                <label className="label-field">Người phụ trách</label>
                <input
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Phòng ban phụ trách</label>
                <select
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
            </div>
          </div>

          {/* 3. Thời hạn & Nhắc hẹn hết hạn */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">3. Thời hạn & Nhắc hẹn hết hạn hợp đồng</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="label-field">Ngày ký</label>
                <DateInputVN value={form.signedDate} onChange={(iso) => setForm({ ...form, signedDate: iso })} />
              </div>
              <div>
                <label className="label-field">Ngày hiệu lực</label>
                <DateInputVN value={form.startDate} onChange={(iso) => setForm({ ...form, startDate: iso })} />
              </div>
              <div>
                <label className="label-field">Ngày hết hạn</label>
                <DateInputVN value={form.endDate} onChange={(iso) => setForm({ ...form, endDate: iso })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
              <div>
                <label className="label-field">Nhắc hẹn trước khi hết hạn (số ngày)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.remindDaysBefore}
                    onChange={(e) => setForm({ ...form, remindDaysBefore: e.target.value })}
                    className="input-field font-mono w-24"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['15', '30', '60', '90'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm({ ...form, remindDaysBefore: d })}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          form.remindDaysBefore === d
                            ? 'bg-brand text-white border-brand'
                            : 'bg-white text-ink-secondary border-line hover:bg-slate-50'
                        }`}
                      >
                        {d} ngày
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pb-2">
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
            </div>

            <div>
              <label className="label-field">Điều khoản / Ghi chú</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                placeholder="Điều khoản thanh toán, bảo hành, gia hạn..."
              />
            </div>
          </div>

          {/* 4. Đính kèm nhiều tệp */}
          <div className="panel p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink-primary">
                4. Hồ sơ & Tệp hợp đồng đính kèm ({attachments.length} tệp)
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={defaultDocType}
                  onChange={(e) => setDefaultDocType(e.target.value)}
                  className="input-field py-1.5 text-xs w-48"
                >
                  {Object.entries(CONTRACT_DOC_TYPES).map(([k, v]) => (
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
                Có thể chọn nhiều tệp cùng lúc (Hợp đồng scan PDF, Phụ lục, Hóa đơn, Biên bản nghiệm thu...).
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
                        {Object.entries(CONTRACT_DOC_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-ink-muted hover:text-red-600 rounded"
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
              <FileText className="w-4 h-4 text-brand" />
              <span className="text-sm font-semibold text-ink-primary">Tóm tắt hợp đồng</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Loại hợp đồng</span>
                <Badge label={typeMeta.label} cls={typeMeta.cls} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Nhà cung cấp</span>
                <span className="font-medium text-ink-primary truncate max-w-[60%]">{form.supplierName || 'Chưa chọn'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Nhắc hẹn trước</span>
                <span className="font-mono font-semibold text-amber-700">{form.remindDaysBefore || 30} ngày</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="text-ink-muted">Giá trị hợp đồng</span>
                <span className="font-mono text-sm font-bold text-brand tabular-nums">
                  {formatVnd(form.contractValue ? Number(form.contractValue) : 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Nhắc hẹn tự động
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Khi còn từ <strong>{form.remindDaysBefore || 30} ngày</strong> trở xuống trước ngày hết hạn, hệ thống tự động đưa thông báo lên <strong>Chuông thông báo</strong> và <strong>Dashboard</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
                <Save className="w-4 h-4" />
                {submitting ? 'Đang lưu...' : 'Lưu hợp đồng mới'}
              </button>
              <Link to="/contracts" className="btn-secondary w-full justify-center">
                Hủy bỏ
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
