import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';

export const EmployeesPage: React.FC = () => {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formErr, setFormErr] = useState('');

  const [form, setForm] = useState({
    code: '',
    fullName: '',
    departmentId: '',
    title: '',
    email: '',
    phone: '',
    isActive: true,
  });

  const load = async () => {
    const [eRes, mRes] = await Promise.allSettled([api.get('/admin/employees'), api.get('/admin/meta')]);
    if (mRes.status === 'fulfilled') {
      setDepartments(mRes.value.data?.departments || []);
    }
    if (eRes.status === 'fulfilled') {
      setItems(Array.isArray(eRes.value.data) ? eRes.value.data : []);
    } else {
      setFeedback({
        type: 'err',
        text: (eRes.reason as any)?.response?.data?.message || 'Không tải được danh sách nhân viên. Kiểm tra backend đã cập nhật và đồng bộ DB chưa.',
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const ensureDepartments = async () => {
    if (departments.length > 0) return;
    try {
      const mRes = await api.get('/admin/meta');
      setDepartments(mRes.data?.departments || []);
    } catch {
      // ignore
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      fullName: '',
      departmentId: deptFilter || '',
      title: '',
      email: '',
      phone: '',
      isActive: true,
    });
    setFormErr('');
    setModalOpen(true);
    ensureDepartments();
  };

  const openEdit = (emp: any) => {
    setEditing(emp);
    setForm({
      code: emp.code || '',
      fullName: emp.fullName || '',
      departmentId: emp.departmentId || '',
      title: emp.title || '',
      email: emp.email || '',
      phone: emp.phone || '',
      isActive: Boolean(emp.isActive),
    });
    setFormErr('');
    setModalOpen(true);
    ensureDepartments();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    setFeedback(null);
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/employees/${editing.id}`, form);
        setFeedback({ type: 'ok', text: `Đã cập nhật nhân viên "${form.fullName.trim()}".` });
      } else {
        await api.post('/admin/employees', form);
        setFeedback({ type: 'ok', text: `Đã thêm nhân viên "${form.fullName.trim()}".` });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu thông tin nhân viên.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp: any) => {
    if (!can('admin.catalogs') || togglingId) return;
    setTogglingId(emp.id);
    setFeedback(null);
    try {
      const nextActive = !emp.isActive;
      await api.patch(`/admin/employees/${emp.id}/active`, { isActive: nextActive });
      setFeedback({
        type: nextActive ? 'ok' : 'err',
        text: `Đã chuyển nhân viên "${emp.fullName}" sang trạng thái ${nextActive ? 'Đang làm việc' : 'Ngưng hoạt động'}.`,
      });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.response?.data?.message || 'Không thể cập nhật trạng thái nhân viên.' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (emp: any) => {
    if (!window.confirm(`Xác nhận xóa nhân viên "${emp.fullName}" (${emp.code})?`)) return;
    setFeedback(null);
    try {
      await api.delete(`/admin/employees/${emp.id}`);
      setFeedback({ type: 'err', text: `Đã xóa nhân viên "${emp.fullName}".` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.response?.data?.message || 'Không thể xóa nhân viên này.' });
    }
  };

  const filtered = items.filter((e) => {
    if (deptFilter && e.departmentId !== deptFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.code || '').toLowerCase().includes(q) ||
      (e.fullName || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      (e.department?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh mục Nhân viên"
        subtitle="Quản lý danh sách nhân sự theo phòng ban để cấp phát, bàn giao tài sản và liên kết với tài khoản đăng nhập hệ thống."
        actions={
          can('admin.catalogs') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm nhân viên
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

      <div className="panel p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã nhân viên, họ tên, chức danh, email..."
            className="input-field pl-9"
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input-field w-56">
          <option value="">Tất cả phòng ban</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Chưa có dữ liệu nhân viên.</div>
          ) : (
            filtered.map((emp) => (
              <div key={emp.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-brand">{emp.code}</span>
                  <Badge
                    label={emp.isActive ? 'Đang làm việc' : 'Ngưng'}
                    cls={emp.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-ink-primary">{emp.fullName}</div>
                  <div className="text-[11px] text-ink-muted">
                    {emp.department?.name || 'Chưa gán phòng ban'}
                    {emp.title ? ` · ${emp.title}` : ''}
                  </div>
                </div>
                {(emp.email || emp.phone) && (
                  <div className="text-[11px] text-ink-secondary">
                    {emp.email || ''}{emp.email && emp.phone ? ' · ' : ''}{emp.phone || ''}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span className="text-[11px] text-ink-muted font-mono">Tài sản: {emp._count?.assets ?? 0}</span>
                  {can('admin.catalogs') && (
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => openEdit(emp)} className="btn-secondary px-2 py-1 text-xs">
                        <Pencil className="w-3.5 h-3.5" /> Sửa
                      </button>
                      <button onClick={() => handleDelete(emp)} className="btn-secondary text-red-600 px-2 py-1 text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
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
                <th className="th-cell">Mã NV</th>
                <th className="th-cell">Họ và tên</th>
                <th className="th-cell">Phòng ban</th>
                <th className="th-cell">Liên hệ</th>
                <th className="th-cell">Tài khoản đăng nhập</th>
                <th className="th-cell text-right">Số tài sản</th>
                <th className="th-cell text-center">Trạng thái</th>
                {can('admin.catalogs') && <th className="th-cell text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={can('admin.catalogs') ? 9 : 8} className="td-cell text-center text-ink-muted py-8">
                    Chưa có dữ liệu nhân viên.
                  </td>
                </tr>
              ) : (
                filtered.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{emp.code}</td>
                    <td className="td-cell">
                      <div className="font-medium text-ink-primary">{emp.fullName}</div>
                      {emp.title && <div className="text-xs text-ink-muted">{emp.title}</div>}
                    </td>
                    <td className="td-cell text-xs">{emp.department?.name || '—'}</td>
                    <td className="td-cell text-xs">
                      <div>{emp.email || '—'}</div>
                      {emp.phone && <div className="font-mono text-ink-muted">{emp.phone}</div>}
                    </td>
                    <td className="td-cell text-xs">
                      {emp.users?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {emp.users.map((u: any) => (
                            <Badge key={u.id} label={u.username} cls="bg-brand-soft text-brand border-sky-200" />
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-muted">Không có</span>
                      )}
                    </td>
                    <td className="td-cell text-right font-mono text-xs tabular-nums">{emp._count?.assets ?? 0}</td>
                    <td className="td-cell text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={emp.isActive}
                          disabled={!can('admin.catalogs') || togglingId === emp.id}
                          onClick={() => handleToggleActive(emp)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 ${
                            emp.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          } ${can('admin.catalogs') ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              emp.isActive ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`text-xs font-medium ${emp.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                          {emp.isActive ? 'Hoạt động' : 'Ngưng'}
                        </span>
                      </div>
                    </td>
                    {can('admin.catalogs') && (
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(emp)}
                            className="btn-secondary px-2 py-1 text-xs"
                            title="Sửa nhân viên"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp)}
                            className="btn-secondary text-red-600 hover:bg-red-50 px-2 py-1 text-xs"
                            title="Xóa nhân viên"
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
        title={editing ? 'Chỉnh sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">
                Mã nhân viên <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="input-field font-mono"
                placeholder="Nhập mã nhân viên"
              />
            </div>
            <div>
              <label className="label-field">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="input-field"
                placeholder="Nhập họ và tên"
              />
            </div>
            <div>
              <label className="label-field">Phòng ban</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Chọn phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Chức danh</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                placeholder="Nhập chức danh"
              />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
                placeholder="Nhập email"
              />
            </div>
            <div>
              <label className="label-field">Số điện thoại</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-field font-mono"
                placeholder="Nhập số điện thoại"
              />
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-line flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Trạng thái làm việc</span>
            <div className="inline-flex items-center gap-2">
              <span className="text-xs font-medium text-ink-primary">
                {form.isActive ? 'Đang làm việc' : 'Ngưng hoạt động'}
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
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm nhân viên'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
