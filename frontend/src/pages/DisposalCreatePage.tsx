import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeDollarSign,
  Trash2,
  Gift,
  Undo2,
  Search,
  AlertTriangle,
  AlertCircle,
  FileWarning,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AssetStatusBadge, Badge } from '../components/UiPrimitives';
import { CurrencyInput, DateInputVN } from '../components/FormInputs';
import { DISPOSAL_METHOD_META, formatVnd } from '../utils/format';

const METHOD_CARDS = [
  {
    key: 'LIQUIDATION',
    icon: BadgeDollarSign,
    idleCls: 'bg-amber-50/45 border-amber-200/80 hover:bg-amber-50/80 hover:border-amber-300',
    activeCls: 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30 shadow-sm',
    iconWrap: 'bg-amber-100/80 text-amber-700',
    titleCls: 'text-amber-900',
  },
  {
    key: 'SCRAP',
    icon: Trash2,
    idleCls: 'bg-rose-50/45 border-rose-200/80 hover:bg-rose-50/80 hover:border-rose-300',
    activeCls: 'bg-rose-50 border-rose-500 ring-1 ring-rose-500/30 shadow-sm',
    iconWrap: 'bg-rose-100/80 text-rose-600',
    titleCls: 'text-rose-900',
  },
  {
    key: 'DONATION',
    icon: Gift,
    idleCls: 'bg-teal-50/45 border-teal-200/80 hover:bg-teal-50/80 hover:border-teal-300',
    activeCls: 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/30 shadow-sm',
    iconWrap: 'bg-teal-100/80 text-teal-600',
    titleCls: 'text-teal-900',
  },
  {
    key: 'RETURN_VENDOR',
    icon: Undo2,
    idleCls: 'bg-indigo-50/45 border-indigo-200/80 hover:bg-indigo-50/80 hover:border-indigo-300',
    activeCls: 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500/30 shadow-sm',
    iconWrap: 'bg-indigo-100/80 text-indigo-600',
    titleCls: 'text-indigo-900',
  },
] as const;

export const DisposalCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId') || '';
  const { user } = useAuth();

  const [assets, setAssets] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [assetQuery, setAssetQuery] = useState('');
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    assetId: preselectedAssetId,
    method: 'LIQUIDATION',
    disposalDate: todayIso,
    decisionNumber: '',
    salvageValue: '',
    approvedBy: user?.fullName || '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.fullName && !form.approvedBy) {
      setForm((prev) => ({ ...prev, approvedBy: user.fullName }));
    }
  }, [user?.fullName]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/assets');
        const list = (res.data || []).filter((a: any) => a.status !== 'DISPOSED');
        setAssets(list);
        if (preselectedAssetId) {
          const found = list.find((a: any) => a.id === preselectedAssetId);
          if (found) setAssetQuery(`${found.assetCode} — ${found.name}`);
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
      setError('Vui lòng chọn tài sản cần thanh lý.');
      return;
    }
    if (!form.reason.trim()) {
      setError('Vui lòng nhập lý do thanh lý tài sản.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/maintenance/disposals', {
        ...form,
        salvageValue: form.salvageValue ? Number(form.salvageValue) : 0,
      });
      navigate('/maintenance?tab=disposals');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lập biên bản thanh lý.');
    } finally {
      setSubmitting(false);
    }
  };

  const methodMeta = DISPOSAL_METHOD_META[form.method] || DISPOSAL_METHOD_META.LIQUIDATION;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/maintenance?tab=disposals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-brand mb-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách hồ sơ thanh lý
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">Lập biên bản thanh lý tài sản</h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Ghi nhận quyết định thanh lý, giá trị thu hồi và cập nhật trạng thái tài sản sang Đã thanh lý.
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
          {/* 1. Hình thức thanh lý */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">1. Hình thức thanh lý</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {METHOD_CARDS.map(({ key, icon: Icon, idleCls, activeCls, iconWrap, titleCls }) => {
                const meta = DISPOSAL_METHOD_META[key];
                const active = form.method === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, method: key }))}
                    className={`text-left p-3.5 rounded-lg border transition-all ${active ? activeCls : idleCls}`}
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

          {/* 2. Chọn tài sản thanh lý */}
          <div className="panel p-4 sm:p-5 space-y-3">
            <div className="text-sm font-semibold text-ink-primary">
              2. Tài sản thanh lý <span className="text-red-500">*</span>
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

          {/* 3. Quyết định & Lý do thanh lý */}
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="text-sm font-semibold text-ink-primary">3. Hồ sơ quyết định & Giá trị thu hồi</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Ngày thanh lý</label>
                <DateInputVN
                  value={form.disposalDate}
                  onChange={(iso) => setForm({ ...form, disposalDate: iso })}
                />
              </div>
              <div>
                <label className="label-field">Số quyết định / Biên bản</label>
                <input
                  value={form.decisionNumber}
                  onChange={(e) => setForm({ ...form, decisionNumber: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập số quyết định thanh lý"
                />
              </div>
              <div>
                <label className="label-field">Giá trị thu hồi (VND)</label>
                <CurrencyInput
                  value={form.salvageValue}
                  onChange={(raw) => setForm({ ...form, salvageValue: raw })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label-field">Người phê duyệt</label>
                <input
                  value={form.approvedBy}
                  onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}
                  className="input-field"
                  placeholder="Họ tên người phê duyệt quyết định"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">
                  Lý do thanh lý <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="input-field"
                  placeholder="Nêu rõ tình trạng hư hỏng, hết khấu hao hoặc căn cứ thanh lý"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Ghi chú bổ sung</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input-field"
                  placeholder="Thông tin bên thu mua, đơn vị tiếp nhận hoặc ghi chú khác"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: TÓM TẮT BIÊN BẢN */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <FileWarning className="w-4 h-4 text-rose-600" />
              <span className="text-sm font-semibold text-ink-primary">Tóm tắt biên bản thanh lý</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Hình thức</span>
                <Badge label={methodMeta.label} cls={methodMeta.cls} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Tài sản</span>
                <span className="font-mono font-semibold text-ink-primary truncate max-w-[60%]">
                  {selectedAsset ? selectedAsset.assetCode : 'Chưa chọn'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Số quyết định</span>
                <span className="font-mono font-medium text-ink-primary truncate max-w-[60%]">
                  {form.decisionNumber.trim() || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Người phê duyệt</span>
                <span className="font-medium text-ink-primary truncate max-w-[60%]">
                  {form.approvedBy.trim() || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="text-ink-muted">Giá trị thu hồi</span>
                <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                  {formatVnd(form.salvageValue ? Number(form.salvageValue) : 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                Lưu ý quan trọng
              </div>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Sau khi xác nhận, tài sản sẽ chuyển sang trạng thái <strong>Đã thanh lý</strong> và được ghi nhận vào nhật ký vòng đời tài sản.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button type="submit" disabled={submitting} className="btn-danger w-full justify-center py-2.5">
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Đang lưu biên bản...' : 'Xác nhận thanh lý tài sản'}
              </button>
              <Link to="/maintenance?tab=disposals" className="btn-secondary w-full justify-center">
                Hủy bỏ
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
