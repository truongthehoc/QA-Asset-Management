import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

export const DepartmentsPage: React.FC = () => {
  const { can } = useAuth();
  const { confirm } = useDialog();
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', locationId: '', description: '' });
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    const res = await api.get('/admin/meta');
    setItems(res.data.departments || []);
    setLocations(res.data.locations || []);
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
    setForm({ code: '', name: '', locationId: '', description: '' });
    setOpen(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      code: d.code || '',
      name: d.name || '',
      locationId: d.locationId || d.location?.id || '',
      description: d.description || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const payload = {
      ...form,
      locationId: form.locationId || null,
    };
    if (editing) {
      await api.patch(`/admin/departments/${editing.id}`, payload);
      setNotice({ type: 'ok', text: `Đã cập nhật phòng ban "${form.name.trim()}".` });
    } else {
      await api.post('/admin/departments', payload);
      setNotice({ type: 'ok', text: `Đã thêm phòng ban "${form.name.trim()}".` });
    }
    setForm({ code: '', name: '', locationId: '', description: '' });
    setEditing(null);
    setOpen(false);
    load();
  };

  const handleDelete = async (d: any) => {
    const ok = await confirm({
      title: 'Ẩn phòng ban',
      message: `Xác nhận ẩn phòng ban "${d.name}" khỏi danh mục sử dụng?`,
      confirmLabel: 'Xác nhận ẩn',
      tone: 'danger',
    });
    if (!ok) return;
    await api.delete(`/admin/departments/${d.id}`);
    setNotice({ type: 'err', text: `Đã ẩn phòng ban "${d.name}".` });
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
        subtitle="Quản lý cơ cấu phòng ban sử dụng, quản lý tài sản và liên kết người dùng theo phòng ban."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm phòng ban
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc tên phòng ban..."
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Chưa có dữ liệu phòng ban.</div>
          ) : (
            filtered.map((d) => (
              <div key={d.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-brand">{d.code}</span>
                  <span className="text-[11px] font-mono text-ink-muted">
                    {d._count?.employees ?? 0} NV · {d._count?.usingAssets ?? 0} TS
                  </span>
                </div>
                <div className="text-xs font-semibold text-ink-primary">{d.name}</div>
                {d.location && (
                  <div className="text-[11px] text-ink-secondary">
                    Vị trí: {d.location.name}
                    {[d.location.building, d.location.floor, d.location.room].filter(Boolean).length > 0
                      ? ` (${[d.location.building, d.location.floor, d.location.room].filter(Boolean).join(' · ')})`
                      : ''}
                  </div>
                )}
                {d.description && <div className="text-[11px] text-ink-muted">{d.description}</div>}
                {can('admin.catalogs') && (
                  <div className="pt-1 flex justify-end gap-1.5">
                    <button onClick={() => openEdit(d)} className="btn-secondary px-2 py-1 text-xs">
                      <Pencil className="w-3.5 h-3.5" /> Sửa
                    </button>
                    <button onClick={() => handleDelete(d)} className="btn-secondary text-red-600 px-2 py-1 text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
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
                <th className="th-cell">Mã phòng ban</th>
                <th className="th-cell">Tên phòng ban</th>
                <th className="th-cell">Vị trí mặc định</th>
                <th className="th-cell text-right">Số nhân viên</th>
                <th className="th-cell text-right">Số tài sản</th>
                <th className="th-cell">Mô tả</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="td-cell text-center text-ink-muted py-8">Chưa có dữ liệu phòng ban.</td></tr>
              ) : (
                filtered.map((d, idx) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{d.code}</td>
                    <td className="td-cell font-medium">{d.name}</td>
                    <td className="td-cell text-xs">
                      {d.location ? (
                        <div>
                          <div className="font-medium text-ink-primary">{d.location.name}</div>
                          {[d.location.building, d.location.floor, d.location.room].filter(Boolean).length > 0 && (
                            <div className="text-[11px] text-ink-muted">
                              {[d.location.building, d.location.floor, d.location.room].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{d._count?.employees ?? 0}</td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{d._count?.usingAssets ?? 0}</td>
                    <td className="td-cell text-xs text-ink-muted">{d.description || '—'}</td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => openEdit(d)} className="btn-secondary px-2 py-1 text-xs" title="Sửa phòng ban">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(d)} className="btn-secondary text-red-600 px-2 py-1 text-xs" title="Ẩn phòng ban">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban mới'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="label-field">Mã phòng ban <span className="text-red-500">*</span></label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã phòng ban" />
          </div>
          <div>
            <label className="label-field">Tên phòng ban <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên phòng ban" />
          </div>
          <div>
            <label className="label-field">Vị trí mặc định</label>
            <select
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              className="input-field"
            >
              <option value="">-- Chọn vị trí --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {[loc.building, loc.floor, loc.room].filter(Boolean).length > 0
                    ? ` (${[loc.building, loc.floor, loc.room].filter(Boolean).join(' · ')})`
                    : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Nhập mô tả phòng ban" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">{editing ? 'Lưu thay đổi' : 'Lưu phòng ban'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
