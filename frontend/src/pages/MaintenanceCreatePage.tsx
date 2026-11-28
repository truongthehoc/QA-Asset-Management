import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Wrench,
  ShieldCheck,
  Cpu,
  CalendarClock,
  Search,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Save,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AssetStatusBadge, Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import { formatVnd, MAINTENANCE_STATUS_META, MAINTENANCE_TYPE_META } from '../utils/format';

const TYPE_CARDS = [
  {
    key: 'REPAIR',
    icon: Wrench,
    idleCls: 'bg-rose-50/45 border-rose-200/80 hover:bg-rose-50/80 hover:border-rose-300',
    activeCls: 'bg-rose-50 border-rose-500 ring-1 ring-rose-500/30 shadow-sm',
    iconWrap: 'bg-rose-100/80 text-rose-600',
    titleCls: 'text-rose-900',
  },
  {
    key: 'PREVENTIVE',
    icon: CalendarClock,
    idleCls: 'bg-teal-50/45 border-teal-200/80 hover:bg-teal-50/80 hover:border-teal-300',
    activeCls: 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/30 shadow-sm',
    iconWrap: 'bg-teal-100/80 text-teal-600',
    titleCls: 'text-teal-900',
  },
  {
    key: 'UPGRADE',
    icon: Cpu,
    idleCls: 'bg-indigo-50/45 border-indigo-200/80 hover:bg-indigo-50/80 hover:border-indigo-300',
    activeCls: 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500/30 shadow-sm',
    iconWrap: 'bg-indigo-100/80 text-indigo-600',
    titleCls: 'text-indigo-900',
  },
  {
    key: 'WARRANTY_CLAIM',
    icon: ShieldCheck,
    idleCls: 'bg-amber-50/45 border-amber-200/80 hover:bg-amber-50/80 hover:border-amber-300',
    activeCls: 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30 shadow-sm',
    iconWrap: 'bg-amber-100/80 text-amber-600',
    titleCls: 'text-amber-900',
  },
] as const;

export const MaintenanceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId') || '';
  const { user } = useAuth();

  const [assets, setAssets] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Searchable asset picker
  const [assetQuery, setAssetQuery] = useState('');
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    assetId: preselectedAssetId,
    maintenanceType: 'REPAIR',
    status: 'OPEN',
    receivedDate: todayIso,
    issueSummary: '',
    conditionBefore: '',
    vendorName: '',
    performedBy: user?.fullName || '',
    cost: '',
    replacedParts: '',
    documentRef: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.fullName && !form.performedBy) {
      setForm((prev) => ({ ...prev, performedBy: user.fullName }));
    }
  }, [user?.fullName]);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, sRes] = await Promise.allSettled([
          api.get('/assets'),
          api.get('/admin/suppliers'),
        ]);
        if (aRes.status === 'fulfilled') {
          const list = (aRes.value.data || []).filter((a: any) => a.status !== 'DISPOSED');
          setAssets(list);
          if (preselectedAssetId) {
            const found = list.find((a: any) => a.id === preselectedAssetId);
            if (found) setAssetQuery(`${found.assetCode} — ${found.name}`);
          }
        }
        if (sRes.status === 'fulfilled') {
          setSuppliers(sRes.value.data || []);
        }
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [preselectedAssetId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setAssetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
  }, [error]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === form.assetId) || null,
    [assets, form.assetId],
  );

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    if (!q) return assets.slice(0, 30);
    return assets
      .filter((a) => {
        const hay = `${a.assetCode} ${a.name} ${a.serialNumber || ''} ${a.usingDepartment?.name || ''} ${a.assignedEmployee?.fullName || a.assignedUserName || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [assets, assetQuery]);

  const handleSelectAsset = (a: any) => {
    setForm((prev) => ({ ...prev, assetId: a.id }));
    setAssetQuery(`${a.assetCode} — ${a.name}`);
    setAssetDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId) {
      setError('Vui lòng chọn tài sản cần lập phiếu bảo trì.');
      return;
    }
    if (!form.issueSummary.trim()) {
      setError('Vui lòng nhập mô tả sự cố / nội dung cần xử lý.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/maintenance', {
        ...form,
        cost: form.cost ? Number(form.cost) : 0,
      });
      navigate(`/maintenance/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lập phiếu bảo trì.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeMeta = MAINTENANCE_TYPE_META[form.maintenanceType] || MAINTENANCE_TYPE_META.REPAIR;
  const statusMeta = MAINTENANCE_STATUS_META[form.status] || MAINTENANCE_STATUS_META.OPEN;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <Link to="/maintenance" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách phiếu bảo trì
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">Lập phiếu bảo trì / sửa chữa</h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Ghi nhận yêu cầu sửa chữa, bảo dưỡng hoặc gửi bảo hành; hệ thống tự động mở nhật ký theo dõi tiến độ.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: BIỂU MẪU NHẬP LIỆU */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Loại phiếu */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">1. Loại phiếu bảo trì</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_CARDS.map(({ key, icon: Icon, idleCls, activeCls, iconWrap, titleCls }) => {
                const meta = MAINTENANCE_TYPE_META[key];
                const active = form.maintenanceType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, maintenanceType: key }))}
                    className={`text-left p-3.5 rounded-lg border transition-all ${
                      active ? activeCls : idleCls
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconWrap}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className={`text-sm font-semibold ${titleCls}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">{meta.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Chọn tài sản */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">
              2. Tài sản cần bảo trì <span className="text-red-500">*</span>
            </div>
            <div className="relative" ref={pickerRef}>
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={assetQuery}
                onFocus={() => setAssetDropdownOpen(true)}
                onChange={(e) => {
                  setAssetQuery(e.target.value);
                  setAssetDropdownOpen(true);
                  if (!e.target.value.trim()) setForm((prev) => ({ ...prev, assetId: '' }));
                }}
                placeholder={loadingData ? 'Đang tải danh sách tài sản...' : 'Tìm theo mã tài sản, tên thiết bị, số serial hoặc phòng ban...'}
                className="input-field pl-9"
              />
              {assetDropdownOpen && !loadingData && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg max-h-64 overflow-y-auto divide-y divide-line">
                  {filteredAssets.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-ink-muted text-center">Không tìm thấy tài sản phù hợp.</div>
                  ) : (
                    filteredAssets.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAsset(a)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 ${
                          a.id === form.assetId ? 'bg-brand/5' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-brand">{a.assetCode}</span>
                            <span className="text-xs font-medium text-ink-primary truncate">{a.name}</span>
                          </div>
                          <div className="text-[11px] text-ink-muted truncate mt-0.5">
                            {a.usingDepartment?.name || 'Kho IT'}
                            {(a.assignedEmployee?.fullName || a.assignedUserName) &&
                              ` · ${a.assignedEmployee?.fullName || a.assignedUserName}`}
                            {a.serialNumber ? ` · SN: ${a.serialNumber}` : ''}
                          </div>
                        </div>
                        <AssetStatusBadge status={a.status} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedAsset && (
              <div className="p-3 rounded-lg bg-slate-50 border border-line grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-ink-muted block">Mã & Tên tài sản</span>
                  <span className="font-mono font-semibold text-brand">{selectedAsset.assetCode}</span>
                  <span className="text-ink-primary block font-medium">{selectedAsset.name}</span>
                </div>
                <div>
                  <span className="text-ink-muted block">Phòng ban / Người sử dụng</span>
                  <span className="text-ink-primary font-medium block">{selectedAsset.usingDepartment?.name || 'Kho IT'}</span>
                  <span className="text-ink-secondary">{selectedAsset.assignedEmployee?.fullName || selectedAsset.assignedUserName || 'Chưa gán'}</span>
                </div>
                <div>
                  <span className="text-ink-muted block">Trạng thái hiện tại</span>
                  <div className="mt-1"><AssetStatusBadge status={selectedAsset.status} /></div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Nội dung sự cố & trạng thái tiếp nhận */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">3. Nội dung sự cố & Tiếp nhận</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Trạng thái ban đầu</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-field"
                >
                  <option value="OPEN">Chờ tiếp nhận</option>
                  <option value="IN_PROGRESS">Đang sửa chữa</option>
                  <option value="WAITING_PARTS">Chờ linh kiện</option>
                </select>
              </div>
              <div>
                <label className="label-field">Ngày tiếp nhận</label>
                <DateInputVN
                  value={form.receivedDate}
                  onChange={(iso) => setForm({ ...form, receivedDate: iso })}
                />
              </div>
            </div>

            <div>
              <label className="label-field">
                Mô tả sự cố / Nội dung cần xử lý <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={form.issueSummary}
                onChange={(e) => setForm({ ...form, issueSummary: e.target.value })}
                className="input-field"
                placeholder="Mô tả chi tiết lỗi phát sinh hoặc hạng mục cần bảo trì"
              />
            </div>

            <div>
              <label className="label-field">Tình trạng thiết bị khi tiếp nhận</label>
              <input
                value={form.conditionBefore}
                onChange={(e) => setForm({ ...form, conditionBefore: e.target.value })}
                className="input-field"
                placeholder="Ghi nhận tình trạng ngoại quan, phụ kiện kèm theo khi nhận máy"
              />
            </div>
          </div>

          {/* 4. Đơn vị thực hiện & Dự toán */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">4. Đơn vị thực hiện & Dự toán chi phí</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Đơn vị sửa chữa / Bảo hành</label>
                <input
                  list="maintenance-vendor-list"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="input-field"
                  placeholder="Nội bộ IT hoặc tên đơn vị sửa chữa"
                />
                <datalist id="maintenance-vendor-list">
                  <option value="Nội bộ IT" />
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label-field">Kỹ thuật viên / Người phụ trách</label>
                <input
                  value={form.performedBy}
                  onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                  className="input-field"
                  placeholder="Họ tên người phụ trách xử lý"
                />
              </div>
              <div>
                <label className="label-field">Chi phí dự kiến (VND)</label>
                <CurrencyInput
                  value={form.cost}
                  onChange={(raw) => setForm({ ...form, cost: raw })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-field">Số chứng từ / Mã biên nhận</label>
                <input
                  value={form.documentRef}
                  onChange={(e) => setForm({ ...form, documentRef: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập mã biên nhận nếu có"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Linh kiện dự kiến thay thế</label>
                <input
                  value={form.replacedParts}
                  onChange={(e) => setForm({ ...form, replacedParts: e.target.value })}
                  className="input-field"
                  placeholder="Liệt kê linh kiện dự kiến thay thế hoặc nâng cấp"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Ghi chú bổ sung</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field"
                  placeholder="Ghi chú thêm cho phiếu bảo trì"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: TÓM TẮT PHIẾU */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <ClipboardList className="w-4 h-4 text-brand" />
              <span className="text-sm font-semibold text-ink-primary">Tóm tắt phiếu bảo trì</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Loại phiếu</span>
                <Badge label={typeMeta.label} cls={typeMeta.cls} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Trạng thái khởi tạo</span>
                <Badge label={statusMeta.label} cls={statusMeta.cls} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Tài sản</span>
                <span className="font-mono font-semibold text-ink-primary truncate max-w-[60%]">
                  {selectedAsset ? selectedAsset.assetCode : 'Chưa chọn'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Đơn vị thực hiện</span>
                <span className="font-medium text-ink-primary truncate max-w-[60%]">
                  {form.vendorName.trim() || 'Nội bộ IT'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Người phụ trách</span>
                <span className="font-medium text-ink-primary truncate max-w-[60%]">
                  {form.performedBy.trim() || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="text-ink-muted">Chi phí dự kiến</span>
                <span className="font-mono text-sm font-bold text-brand tabular-nums">
                  {formatVnd(form.cost ? Number(form.cost) : 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50/80 border border-sky-200 text-xs text-sky-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                Tự động đồng bộ hệ thống
              </div>
              <p className="text-[11px] leading-relaxed text-sky-800">
                Khi lập phiếu, trạng thái tài sản sẽ tự chuyển sang <strong>Đang sửa chữa</strong> và dòng nhật ký khởi tạo sẽ được ghi nhận ngay.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
                <Save className="w-4 h-4" />
                {submitting ? 'Đang lập phiếu...' : 'Lập phiếu bảo trì'}
              </button>
              <Link to="/maintenance" className="btn-secondary w-full justify-center">
                Hủy bỏ
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
