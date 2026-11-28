import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

export const AssetCategoriesPage: React.FC = () => {
  const { can } = useAuth();
  const { confirm } = useDialog();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formErr, setFormErr] = useState('');

  const load = async () => {
    const res = await api.get('/admin/meta');
    setItems(res.data.categories || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '' });
    setFormErr('');
    setModalOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({ code: cat.code || '', name: cat.name || '', description: cat.description || '' });
    setFormErr('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    setFeedback(null);
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/asset-categories/${editing.id}`, form);
        setFeedback({ type: 'ok', text: `Đã cập nhật nhóm tài sản "${form.name.trim()}".` });
      } else {
        await api.post('/admin/asset-categories', form);
        setFeedback({ type: 'ok', text: `Đã thêm nhóm tài sản "${form.name.trim()}".` });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu nhóm tài sản.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: any) => {
    const ok = await confirm({
      title: 'Xóa nhóm tài sản',
      message: `Xác nhận xóa nhóm tài sản "${cat.name}"?`,
      confirmLabel: 'Xóa nhóm',
      tone: 'danger',
    });
    if (!ok) return;
    setFeedback(null);
    try {
      await api.delete(`/admin/asset-categories/${cat.id}`);
      setFeedback({ type: 'err', text: `Đã xóa nhóm tài sản "${cat.name}".` });
      load();
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.response?.data?.message || 'Không thể xóa nhóm tài sản này.',
      });
    }
  };

  const filtered = items.filter(
    (c) =>
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Nhóm tài sản"
        subtitle="Phân nhóm tổng thể tài sản để tổ chức các loại tài sản và tổng hợp báo cáo."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm nhóm tài sản
            </button>
          )
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-md border text-sm flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc tên nhóm tài sản..."
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
                <th className="th-cell">Mã nhóm</th>
                <th className="th-cell">Tên nhóm tài sản</th>
                <th className="th-cell text-right">Số loại tài sản</th>
                <th className="th-cell text-right">Số tài sản</th>
                <th className="th-cell">Mô tả</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={can('admin.catalogs') ? 7 : 6} className="td-cell text-center text-ink-muted py-8">
                    Chưa có dữ liệu nhóm tài sản.
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{c.code}</td>
                    <td className="td-cell font-medium">{c.name}</td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{c._count?.types ?? 0}</td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{c._count?.assets ?? 0}</td>
                    <td className="td-cell text-xs text-ink-secondary">{c.description || '—'}</td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(c)}
                            className="btn-secondary px-2 py-1 text-xs"
                            title="Sửa nhóm tài sản"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="btn-secondary text-red-600 hover:bg-red-50 px-2 py-1 text-xs"
                            title="Xóa nhóm tài sản"
                          >
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Chỉnh sửa nhóm tài sản' : 'Thêm nhóm tài sản mới'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}
          <div>
            <label className="label-field">
              Mã nhóm <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="input-field font-mono"
              placeholder="Nhập mã nhóm tài sản"
            />
          </div>
          <div>
            <label className="label-field">
              Tên nhóm tài sản <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Nhập tên nhóm tài sản"
            />
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              placeholder="Nhập mô tả nhóm tài sản"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm nhóm tài sản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
