import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

export const DepartmentsPage: React.FC = () => {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/admin/meta');
    setItems(res.data.departments || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    await api.post('/admin/departments', form);
    setForm({ code: '', name: '', description: '' });
    setOpen(false);
    setMsg('Đã thêm phòng ban mới.');
    load();
  };

  const handleDelete = async (d: any) => {
    if (!window.confirm(`Xác nhận ẩn phòng ban "${d.name}"?`)) return;
    await api.delete(`/admin/departments/${d.id}`);
    load();
  };

  const filtered = items.filter(
    (d) =>
      !search.trim() ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Phòng ban"
        subtitle="Quản lý cơ cấu phòng ban sử dụng và quản lý tài sản trong công ty."
        actions={
          can('admin.catalogs') && (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm phòng ban
            </button>
          )
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc tên phòng ban..."
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã phòng ban</th>
                <th className="th-cell">Tên phòng ban</th>
                <th className="th-cell">Mô tả</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="td-cell text-center text-ink-muted py-8">Chưa có dữ liệu phòng ban.</td></tr>
              ) : (
                filtered.map((d, idx) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{d.code}</td>
                    <td className="td-cell font-medium">{d.name}</td>
                    <td className="td-cell text-xs text-ink-muted">{d.description || '—'}</td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <button onClick={() => handleDelete(d)} className="btn-secondary text-red-600 px-2 py-1 text-xs" title="Ẩn phòng ban">
                          <Trash2 className="w-3.5 h-3.5" />
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

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm phòng ban mới" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label className="label-field">Mã phòng ban <span className="text-red-500">*</span></label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã phòng ban" />
          </div>
          <div>
            <label className="label-field">Tên phòng ban <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên phòng ban" />
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu phòng ban</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
