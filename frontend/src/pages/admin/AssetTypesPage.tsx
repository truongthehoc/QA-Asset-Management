import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Search, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';

export const AssetTypesPage: React.FC = () => {
  const { can } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formErr, setFormErr] = useState('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    categoryId: '',
    supportsAgent: false,
    sortOrder: '1',
    isActive: true,
    description: '',
  });

  const load = async () => {
    const [tRes, mRes] = await Promise.allSettled([api.get('/admin/asset-types'), api.get('/admin/meta')]);
    if (tRes.status === 'fulfilled') {
      setTypes(Array.isArray(tRes.value.data) ? tRes.value.data : []);
    } else if (mRes.status === 'fulfilled') {
      setTypes(mRes.value.data?.assetTypes || []);
    }
    if (mRes.status === 'fulfilled') {
      setCategories(mRes.value.data?.categories || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const openCreate = () => {
    setEditing(null);
    setFormErr('');
    const maxOrder = types.reduce((acc, item) => Math.max(acc, Number(item.sortOrder || 0)), 0);
    setForm({
      code: '',
      name: '',
      categoryId: categories[0]?.id || '',
      supportsAgent: false,
      sortOrder: String(maxOrder + 1),
      isActive: true,
      description: '',
    });
    setOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setFormErr('');
    setForm({
      code: t.code || '',
      name: t.name || '',
      categoryId: t.categoryId || t.category?.id || '',
      supportsAgent: Boolean(t.supportsAgent),
      sortOrder: String(t.sortOrder ?? 0),
      isActive: Boolean(t.isActive),
      description: t.description || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    setNotice(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await api.patch(`/admin/asset-types/${editing.id}`, payload);
        setNotice({ type: 'ok', text: `Đã cập nhật loại tài sản "${form.name.trim()}".` });
      } else {
        await api.post('/admin/asset-types', payload);
        setNotice({ type: 'ok', text: `Đã thêm loại tài sản "${form.name.trim()}".` });
      }
      setOpen(false);
      setEditing(null);
      load();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu loại tài sản.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: any) => {
    if (!can('admin.catalogs') || togglingId) return;
    setTogglingId(t.id);
    const nextActive = !t.isActive;
    try {
      await api.patch(`/admin/asset-types/${t.id}/active`, { isActive: nextActive });
      setNotice({
        type: nextActive ? 'ok' : 'err',
        text: `Đã chuyển loại tài sản "${t.name}" sang trạng thái ${nextActive ? 'Kích hoạt' : 'Ngưng sử dụng'}.`,
      });
      load();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.response?.data?.message || 'Không thể cập nhật trạng thái.' });
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = types.filter(
    (t) =>
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      (t.category?.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Loại tài sản"
        subtitle="Phân loại tài sản, thứ tự ưu tiên hiển thị trong dropdown, mã tiền tố ({TYPE}) và cấu hình hỗ trợ Windows Agent."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm loại tài sản
            </button>
          )
        }
      />

      {notice && (
        <div
          className={`p-3 rounded-md border text-sm flex items-center gap-2 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã, tên loại hoặc nhóm..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Chưa có dữ liệu loại tài sản.</div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className={`p-3.5 space-y-2 ${!t.isActive ? 'opacity-65' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand">{t.code}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-semibold">
                      #{t.sortOrder ?? 0}
                    </span>
                  </div>
                  <Badge
                    label={t.isActive ? 'Kích hoạt' : 'Ngưng'}
                    cls={t.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                  />
                </div>
                <div className="text-xs font-semibold text-ink-primary">{t.name}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary">
                  <span>Nhóm: {t.category?.name || '—'}</span>
                  <span>•</span>
                  <span>{t.supportsAgent ? 'Hỗ trợ Windows Agent' : 'Quản lý thủ công'}</span>
                </div>
                {can('admin.catalogs') && (
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={togglingId === t.id}
                      onClick={() => handleToggleActive(t)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      {t.isActive ? 'Tạm ngưng' : 'Kích hoạt lại'}
                    </button>
                    <button onClick={() => openEdit(t)} className="btn-secondary px-2 py-1 text-xs">
                      <Pencil className="w-3.5 h-3.5" /> Sửa
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell w-20 text-center">Thứ tự</th>
                <th className="th-cell">Mã loại (Prefix)</th>
                <th className="th-cell">Tên loại tài sản</th>
                <th className="th-cell">Nhóm tài sản</th>
                <th className="th-cell">Cơ chế thu thập</th>
                <th className="th-cell text-center">Trạng thái</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={can('admin.catalogs') ? 8 : 7} className="td-cell text-center text-ink-muted py-8">
                    Chưa có dữ liệu loại tài sản.
                  </td>
                </tr>
              ) : (
                filtered.map((t, idx) => (
                  <tr key={t.id} className={`hover:bg-slate-50/70 ${!t.isActive ? 'opacity-65' : ''}`}>
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-xs font-semibold text-ink-primary tabular-nums">
                        {t.sortOrder ?? 0}
                      </span>
                    </td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{t.code}</td>
                    <td className="td-cell">
                      <div className="font-medium text-ink-primary">{t.name}</div>
                      {t.description && <div className="text-[11px] text-ink-muted">{t.description}</div>}
                    </td>
                    <td className="td-cell text-xs text-ink-secondary">{t.category?.name || '—'}</td>
                    <td className="td-cell">
                      {t.supportsAgent ? (
                        <Badge label="Hỗ trợ Windows Agent" cls="bg-brand-soft text-brand border-sky-200" />
                      ) : (
                        <Badge label="Quản lý thủ công" cls="bg-slate-100 text-slate-600 border-slate-200" />
                      )}
                    </td>
                    <td className="td-cell text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={t.isActive}
                          disabled={!can('admin.catalogs') || togglingId === t.id}
                          onClick={() => handleToggleActive(t)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 ${
                            t.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          } ${can('admin.catalogs') ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              t.isActive ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`text-xs font-medium ${t.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                          {t.isActive ? 'Kích hoạt' : 'Ngưng'}
                        </span>
                      </div>
                    </td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <button onClick={() => openEdit(t)} className="btn-secondary px-2 py-1 text-xs" title="Chỉnh sửa loại tài sản">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Chỉnh sửa loại tài sản' : 'Thêm loại tài sản mới'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Mã loại (Prefix) <span className="text-red-500">*</span></label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã loại" />
            </div>
            <div>
              <label className="label-field">Thứ tự hiển thị</label>
              <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="input-field font-mono tabular-nums" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="label-field">Tên loại tài sản <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên loại tài sản" />
          </div>

          <div>
            <label className="label-field">Nhóm tài sản <span className="text-red-500">*</span></label>
            <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field">
              <option value="">-- Chọn nhóm tài sản --</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={form.supportsAgent} onChange={(e) => setForm({ ...form, supportsAgent: e.target.checked })} />
            Thiết bị thuộc loại này hỗ trợ cài đặt Windows Agent kiểm kê tự động
          </label>

          <div>
            <label className="label-field">Mô tả</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Nhập mô tả" />
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-line flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Trạng thái sử dụng</span>
            <div className="inline-flex items-center gap-2">
              <span className={`text-xs font-medium ${form.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                {form.isActive ? 'Kích hoạt' : 'Ngưng sử dụng'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  form.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Lưu loại tài sản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
