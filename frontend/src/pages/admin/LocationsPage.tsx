import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

export const LocationsPage: React.FC = () => {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', building: '', floor: '', room: '' });
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    const res = await api.get('/admin/meta');
    setItems(res.data.locations || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    await api.post('/admin/locations', form);
    setForm({ code: '', name: '', building: '', floor: '', room: '' });
    setOpen(false);
    setNotice({ type: 'ok', text: 'Đã thêm vị trí đặt thiết bị mới.' });
    load();
  };

  const handleDelete = async (l: any) => {
    if (!window.confirm(`Xác nhận ẩn vị trí "${l.name}"?`)) return;
    await api.delete(`/admin/locations/${l.id}`);
    setNotice({ type: 'err', text: `Đã ẩn vị trí "${l.name}".` });
    load();
  };

  const filtered = items.filter(
    (l) =>
      !search.trim() ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Vị trí"
        subtitle="Quản lý tòa nhà, tầng và phòng đặt thiết bị phục vụ bàn giao và kiểm kê."
        actions={
          can('admin.catalogs') && (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm vị trí
            </button>
          )
        }
      />

      {notice && (
        <div
          className={`p-3 rounded-md border text-sm ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã hoặc tên vị trí..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.map((l) => (
            <div key={l.id} className="p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="font-mono text-xs font-bold text-brand">{l.code}</div>
                <div className="text-xs font-semibold text-ink-primary">{l.name}</div>
                <div className="text-[11px] text-ink-secondary">
                  {[l.building, l.floor, l.room].filter(Boolean).join(' • ') || '—'}
                </div>
              </div>
              {can('admin.catalogs') && (
                <button onClick={() => handleDelete(l)} className="btn-secondary text-red-600 px-2 py-1 text-xs shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã vị trí</th>
                <th className="th-cell">Tên vị trí</th>
                <th className="th-cell">Tòa nhà / Tầng / Phòng</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, idx) => (
                <tr key={l.id} className="hover:bg-slate-50/70">
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold text-brand">{l.code}</td>
                  <td className="td-cell font-medium">{l.name}</td>
                  <td className="td-cell text-xs text-ink-secondary">
                    {[l.building, l.floor, l.room].filter(Boolean).join(' • ') || '—'}
                  </td>
                  {can('admin.catalogs') && (
                    <td className="td-cell text-right">
                      <button onClick={() => handleDelete(l)} className="btn-secondary text-red-600 px-2 py-1 text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm vị trí mới" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label className="label-field">Mã vị trí <span className="text-red-500">*</span></label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã vị trí" />
          </div>
          <div>
            <label className="label-field">Tên vị trí <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên vị trí" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">Tòa nhà</label>
              <input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} className="input-field" placeholder="Nhập tòa nhà" />
            </div>
            <div>
              <label className="label-field">Tầng</label>
              <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="input-field" placeholder="Nhập tầng" />
            </div>
            <div>
              <label className="label-field">Phòng</label>
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="input-field" placeholder="Nhập phòng" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu vị trí</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
