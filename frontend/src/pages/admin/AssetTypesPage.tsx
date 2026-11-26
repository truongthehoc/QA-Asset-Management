import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';

export const AssetTypesPage: React.FC = () => {
  const { can } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', categoryId: '', supportsAgent: false, description: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/admin/meta');
    setTypes(res.data.assetTypes || []);
    setCategories(res.data.categories || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ code: '', name: '', categoryId: categories[0]?.id || '', supportsAgent: false, description: '' });
    setOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    await api.post('/admin/asset-types', form);
    setOpen(false);
    setMsg('Đã thêm loại tài sản mới.');
    load();
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
        subtitle="Phân loại tài sản CNTT, quy ước mã tiền tố sinh mã tự động ({TYPE}) và cấu hình hỗ trợ Windows Agent."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm loại tài sản
            </button>
          )
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã, tên loại hoặc nhóm..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã loại (Prefix)</th>
                <th className="th-cell">Tên loại tài sản</th>
                <th className="th-cell">Nhóm tài sản</th>
                <th className="th-cell">Cơ chế thu thập</th>
                <th className="th-cell">Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold text-brand">{t.code}</td>
                  <td className="td-cell font-medium">{t.name}</td>
                  <td className="td-cell text-xs text-ink-secondary">{t.category?.name || '—'}</td>
                  <td className="td-cell">
                    {t.supportsAgent ? (
                      <Badge label="Hỗ trợ Windows Agent" cls="bg-brand-soft text-brand border-sky-200" />
                    ) : (
                      <Badge label="Quản lý thủ công" cls="bg-slate-100 text-slate-600 border-slate-200" />
                    )}
                  </td>
                  <td className="td-cell text-xs text-ink-muted">{t.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm loại tài sản mới" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Mã loại (Prefix) <span className="text-red-500">*</span></label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã loại" />
            </div>
            <div>
              <label className="label-field">Nhóm tài sản <span className="text-red-500">*</span></label>
              <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">Tên loại tài sản <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên loại tài sản" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.supportsAgent} onChange={(e) => setForm({ ...form, supportsAgent: e.target.checked })} className="w-4 h-4 accent-brand" />
            <span>Hỗ trợ cài đặt Windows Agent thu thập cấu hình tự động</span>
          </label>
          <div>
            <label className="label-field">Mô tả</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu loại tài sản</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
