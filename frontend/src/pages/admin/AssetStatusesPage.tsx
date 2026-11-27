import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { AssetStatusItem, useAssetStatuses } from '../../contexts/AssetStatusContext';
import { PageHeader, Modal } from '../../components/UiPrimitives';

const COLOR_PRESETS = [
  { label: 'Xanh lá', bg: '#ECFDF5', text: '#047857' },
  { label: 'Xanh dương', bg: '#F0F9FF', text: '#0369A1' },
  { label: 'Vàng cam', bg: '#FFFBEB', text: '#B45309' },
  { label: 'Đỏ', bg: '#FEF2F2', text: '#B91C1C' },
  { label: 'Hồng', bg: '#FFF1F2', text: '#BE123C' },
  { label: 'Tím', bg: '#F5F3FF', text: '#6D28D9' },
  { label: 'Xám', bg: '#F1F5F9', text: '#475569' },
];

export const AssetStatusesPage: React.FC = () => {
  const { can } = useAuth();
  const { statuses, refresh } = useAssetStatuses();
  const [items, setItems] = useState<AssetStatusItem[]>(statuses);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetStatusItem | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    bgColor: '#ECFDF5',
    textColor: '#047857',
    isActive: true,
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formErr, setFormErr] = useState('');

  const load = async () => {
    const res = await api.get('/admin/asset-statuses');
    setItems(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      bgColor: '#ECFDF5',
      textColor: '#047857',
      isActive: true,
      description: '',
    });
    setFormErr('');
    setModalOpen(true);
  };

  const openEdit = (st: AssetStatusItem) => {
    setEditing(st);
    setForm({
      code: st.code || '',
      name: st.name || '',
      bgColor: st.bgColor || '#ECFDF5',
      textColor: st.textColor || '#047857',
      isActive: Boolean(st.isActive),
      description: st.description || '',
    });
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
        await api.patch(`/admin/asset-statuses/${editing.id}`, form);
        setFeedback({ type: 'ok', text: `Đã cập nhật trạng thái tài sản "${form.name.trim()}".` });
      } else {
        await api.post('/admin/asset-statuses', form);
        setFeedback({ type: 'ok', text: `Đã thêm trạng thái tài sản "${form.name.trim()}".` });
      }
      setModalOpen(false);
      await Promise.all([load(), refresh()]);
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu trạng thái tài sản.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (st: AssetStatusItem) => {
    if (!can('admin.catalogs') || togglingId) return;
    setTogglingId(st.id);
    setFeedback(null);
    try {
      const nextActive = !st.isActive;
      await api.patch(`/admin/asset-statuses/${st.id}/active`, { isActive: nextActive });
      await Promise.all([load(), refresh()]);
      setFeedback({
        type: nextActive ? 'ok' : 'err',
        text: `Đã ${nextActive ? 'kích hoạt' : 'ngưng sử dụng'} trạng thái "${st.name}".`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.response?.data?.message || 'Không thể cập nhật trạng thái kích hoạt.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (st: AssetStatusItem) => {
    if (!window.confirm(`Xác nhận xóa trạng thái tài sản "${st.name}"?`)) return;
    setFeedback(null);
    try {
      await api.delete(`/admin/asset-statuses/${st.id}`);
      setFeedback({ type: 'ok', text: `Đã xóa trạng thái tài sản "${st.name}".` });
      await Promise.all([load(), refresh()]);
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.response?.data?.message || 'Không thể xóa trạng thái tài sản này.',
      });
    }
  };

  const filtered = items.filter(
    (s) =>
      !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Trạng thái tài sản"
        subtitle="Cấu hình mã, tên, màu hiển thị và trạng thái kích hoạt cho các trạng thái tài sản sử dụng trong toàn hệ thống."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm trạng thái
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
            placeholder="Tìm theo mã hoặc tên trạng thái..."
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
                <th className="th-cell">Mã trạng thái</th>
                <th className="th-cell">Tên trạng thái</th>
                <th className="th-cell">Hiển thị</th>
                <th className="th-cell">Màu nền / Màu chữ</th>
                <th className="th-cell text-right">Số tài sản</th>
                <th className="th-cell text-center">Kích hoạt</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={can('admin.catalogs') ? 8 : 7} className="td-cell text-center text-ink-muted py-8">
                    Chưa có dữ liệu trạng thái tài sản.
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{s.code}</td>
                    <td className="td-cell">
                      <div className="font-medium text-ink-primary">{s.name}</div>
                      {s.description && <div className="text-xs text-ink-muted">{s.description}</div>}
                    </td>
                    <td className="td-cell">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded border whitespace-nowrap"
                        style={{
                          backgroundColor: s.bgColor,
                          color: s.textColor,
                          borderColor: `${s.textColor}33`,
                        }}
                      >
                        {s.name}
                      </span>
                    </td>
                    <td className="td-cell">
                      <div className="flex items-center gap-3 text-xs font-mono text-ink-secondary">
                        <span className="inline-flex items-center gap-1.5" title="Màu nền">
                          <span
                            className="w-4 h-4 rounded border border-slate-300 shrink-0"
                            style={{ backgroundColor: s.bgColor }}
                          />
                          {s.bgColor}
                        </span>
                        <span className="inline-flex items-center gap-1.5" title="Màu chữ">
                          <span
                            className="w-4 h-4 rounded border border-slate-300 shrink-0"
                            style={{ backgroundColor: s.textColor }}
                          />
                          {s.textColor}
                        </span>
                      </div>
                    </td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{s.assetCount ?? 0}</td>
                    <td className="td-cell text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={s.isActive}
                          disabled={!can('admin.catalogs') || togglingId === s.id}
                          onClick={() => handleToggleActive(s)}
                          title={s.isActive ? 'Đang kích hoạt — nhấn để ngưng' : 'Đang ngưng — nhấn để kích hoạt'}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 ${
                            s.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          } ${can('admin.catalogs') ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              s.isActive ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`text-xs font-medium ${s.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                          {s.isActive ? 'Kích hoạt' : 'Ngưng'}
                        </span>
                      </div>
                    </td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(s)}
                            className="btn-secondary px-2 py-1 text-xs"
                            title="Sửa trạng thái"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="btn-secondary text-red-600 hover:bg-red-50 px-2 py-1 text-xs"
                            title="Xóa trạng thái"
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
        title={editing ? 'Chỉnh sửa trạng thái tài sản' : 'Thêm trạng thái tài sản mới'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label-field">
                Mã trạng thái <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                className="input-field font-mono"
                placeholder="Nhập mã trạng thái"
              />
            </div>
            <div>
              <label className="label-field">
                Tên trạng thái <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Nhập tên trạng thái"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label-field">Màu nền</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(e) => setForm({ ...form, bgColor: e.target.value.toUpperCase() })}
                  className="w-10 h-9 p-0.5 rounded border border-line bg-white cursor-pointer shrink-0"
                />
                <input
                  value={form.bgColor}
                  onChange={(e) => setForm({ ...form, bgColor: e.target.value.toUpperCase() })}
                  className="input-field font-mono text-xs"
                  placeholder="#ECFDF5"
                />
              </div>
            </div>
            <div>
              <label className="label-field">Màu chữ</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.textColor}
                  onChange={(e) => setForm({ ...form, textColor: e.target.value.toUpperCase() })}
                  className="w-10 h-9 p-0.5 rounded border border-line bg-white cursor-pointer shrink-0"
                />
                <input
                  value={form.textColor}
                  onChange={(e) => setForm({ ...form, textColor: e.target.value.toUpperCase() })}
                  className="input-field font-mono text-xs"
                  placeholder="#047857"
                />
              </div>
            </div>
          </div>

          {/* Quick color presets */}
          <div>
            <div className="text-xs text-ink-secondary mb-1.5">Bộ màu gợi ý</div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setForm({ ...form, bgColor: p.bg, textColor: p.text })}
                  className="px-2 py-1 rounded border text-[11px] font-medium transition-opacity hover:opacity-85"
                  style={{
                    backgroundColor: p.bg,
                    color: p.text,
                    borderColor: `${p.text}33`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview & Active toggle */}
          <div className="p-3 rounded-md bg-slate-50 border border-line flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-ink-muted mb-1">Xem trước hiển thị</div>
              <span
                className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded border whitespace-nowrap"
                style={{
                  backgroundColor: form.bgColor,
                  color: form.textColor,
                  borderColor: `${form.textColor}33`,
                }}
              >
                {form.name.trim() || 'Tên trạng thái'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-ink-secondary">
                {form.isActive ? 'Kích hoạt' : 'Ngưng sử dụng'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer ${
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

          <div>
            <label className="label-field">Mô tả</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              placeholder="Nhập mô tả trạng thái"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm trạng thái'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
