import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

export const SuppliersPage: React.FC = () => {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', taxCode: '', contactName: '', phone: '', email: '', address: '' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/admin/meta');
    setItems(res.data.suppliers || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 3000);
    return () => window.clearTimeout(t);
  }, [msg]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    await api.post('/admin/suppliers', form);
    setForm({ code: '', name: '', taxCode: '', contactName: '', phone: '', email: '', address: '' });
    setOpen(false);
    setMsg('Đã thêm nhà cung cấp mới.');
    load();
  };

  const filtered = items.filter(
    (s) =>
      !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.taxCode || '').includes(search),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Nhà cung cấp"
        subtitle="Quản lý danh sách nhà cung cấp thiết bị, thông tin liên hệ và đầu mối bảo hành."
        actions={
          can('admin.catalogs') && (
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm nhà cung cấp
            </button>
          )
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã, tên nhà cung cấp, MST..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.map((s) => (
            <div key={s.id} className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-brand">{s.code}</span>
                {s.taxCode && <span className="font-mono text-[11px] text-ink-muted">MST: {s.taxCode}</span>}
              </div>
              <div className="text-xs font-semibold text-ink-primary">{s.name}</div>
              {(s.contactName || s.phone || s.email) && (
                <div className="text-[11px] text-ink-secondary">
                  {[s.contactName, s.phone, s.email].filter(Boolean).join(' • ')}
                </div>
              )}
              {s.address && <div className="text-[11px] text-ink-muted">{s.address}</div>}
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã NCC</th>
                <th className="th-cell">Tên nhà cung cấp</th>
                <th className="th-cell">Mã số thuế</th>
                <th className="th-cell">Đầu mối liên hệ</th>
                <th className="th-cell">Địa chỉ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold text-brand">{s.code}</td>
                  <td className="td-cell font-medium">{s.name}</td>
                  <td className="td-cell font-mono text-xs">{s.taxCode || '—'}</td>
                  <td className="td-cell text-xs">
                    <div className="font-medium text-ink-primary">{s.contactName || '—'}</div>
                    <div className="text-ink-muted">{[s.phone, s.email].filter(Boolean).join(' • ') || '—'}</div>
                  </td>
                  <td className="td-cell text-xs text-ink-secondary max-w-xs">{s.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Thêm nhà cung cấp mới" maxWidth="max-w-xl">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Mã NCC <span className="text-red-500">*</span></label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="Nhập mã nhà cung cấp" />
            </div>
            <div>
              <label className="label-field">Mã số thuế</label>
              <input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} className="input-field font-mono" placeholder="Nhập mã số thuế" />
            </div>
          </div>
          <div>
            <label className="label-field">Tên nhà cung cấp <span className="text-red-500">*</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nhập tên nhà cung cấp" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">Người liên hệ</label>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Điện thoại</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Địa chỉ</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu nhà cung cấp</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
