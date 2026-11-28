import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Search, X, Building2, AlertCircle, UserCheck } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';
import { formatDateTime } from '../../utils/format';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], roles: [], employees: [] });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Employee searchable combobox state
  const [empQuery, setEmpQuery] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empBoxRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    username: '',
    password: '',
    employeeId: '',
    fullName: '',
    email: '',
    title: '',
    roleId: '',
    scopeType: 'ORGANIZATION',
    isActive: true,
  });

  const load = async () => {
    const [uRes, mRes] = await Promise.allSettled([api.get('/admin/users'), api.get('/admin/meta')]);
    if (uRes.status === 'fulfilled') setUsers(uRes.value.data || []);
    if (mRes.status === 'fulfilled') setMeta(mRes.value.data || { departments: [], roles: [], employees: [] });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (empBoxRef.current && !empBoxRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const employees: any[] = meta.employees || [];
  const deptNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of meta.departments || []) map.set(d.id, d.name);
    return map;
  }, [meta.departments]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === form.employeeId) || null,
    [employees, form.employeeId],
  );

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 30);
    return employees
      .filter((e) => {
        const deptName = e.department?.name || deptNameById.get(e.departmentId) || '';
        return (
          (e.fullName || '').toLowerCase().includes(q) ||
          (e.code || '').toLowerCase().includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          deptName.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [employees, empQuery, deptNameById]);

  const openCreate = () => {
    setEditing(null);
    setFormErr('');
    setEmpQuery('');
    setEmpDropdownOpen(false);
    setForm({
      username: '',
      password: '',
      employeeId: '',
      fullName: '',
      email: '',
      title: '',
      roleId: '',
      scopeType: 'ORGANIZATION',
      isActive: true,
    });
    setOpen(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setFormErr('');
    const linked = u.employee || employees.find((e) => e.id === u.employeeId);
    setEmpQuery(linked ? `${linked.code} — ${linked.fullName}` : '');
    setEmpDropdownOpen(false);
    setForm({
      username: u.username || '',
      password: '',
      employeeId: u.employeeId || '',
      fullName: u.fullName || '',
      email: u.email || '',
      title: u.title || '',
      roleId: u.userRoles?.[0]?.roleId || '',
      scopeType: u.userRoles?.[0]?.scopeType || 'ORGANIZATION',
      isActive: Boolean(u.isActive),
    });
    setOpen(true);
  };

  const handleSelectEmployee = (emp: any) => {
    setForm((prev) => ({
      ...prev,
      employeeId: emp.id,
      fullName: emp.fullName,
      email: emp.email || prev.email,
      title: emp.title || '',
    }));
    setEmpQuery(`${emp.code} — ${emp.fullName}`);
    setEmpDropdownOpen(false);
  };

  const handleClearEmployee = () => {
    setForm((prev) => ({ ...prev, employeeId: '' }));
    setEmpQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setFormErr('');
    if (!editing && !form.employeeId) {
      setFormErr('Vui lòng chọn nhân viên để gán với tài khoản.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/users/${editing.id}`, {
          employeeId: form.employeeId || null,
          fullName: selectedEmployee ? selectedEmployee.fullName : form.fullName,
          email: selectedEmployee?.email || form.email,
          title: selectedEmployee ? selectedEmployee.title || null : form.title,
          isActive: form.isActive,
        });
        setNotice({ type: form.isActive ? 'ok' : 'err', text: `Đã cập nhật thông tin tài khoản "${editing.username}".` });
      } else {
        await api.post('/admin/users', {
          username: form.username.trim(),
          password: form.password || undefined,
          employeeId: form.employeeId,
          fullName: selectedEmployee?.fullName,
          email: selectedEmployee?.email || undefined,
          roleId: form.roleId,
          scopeType: form.scopeType,
          isActive: form.isActive,
        });
        setNotice({ type: 'ok', text: `Đã tạo tài khoản "${form.username.trim()}" thành công.` });
      }
      setOpen(false);
      setEditing(null);
      load();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu thông tin tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: any) => {
    if (togglingId) return;
    setTogglingId(u.id);
    const nextActive = !u.isActive;
    try {
      await api.patch(`/admin/users/${u.id}/active`, { isActive: nextActive });
      setNotice({
        type: nextActive ? 'ok' : 'err',
        text: `Đã chuyển tài khoản "${u.username}" sang trạng thái ${nextActive ? 'Kích hoạt' : 'Ngưng'}.`,
      });
      load();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản.' });
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.employee?.code || '').toLowerCase().includes(search.toLowerCase()),
  );

  const selectedDeptName = selectedEmployee
    ? selectedEmployee.department?.name || deptNameById.get(selectedEmployee.departmentId) || 'Chưa gán phòng ban'
    : '';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý Người dùng"
        subtitle="Quản lý tài khoản đăng nhập hệ thống (quản trị, kế toán, vận hành), liên kết với nhân viên và phân quyền RBAC."
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Tạo người dùng
          </button>
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tài khoản, mã NV, họ tên, email..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">Không có người dùng nào.</div>
          ) : (
            filtered.map((u) => (
              <div key={u.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-brand">@{u.username}</span>
                  <Badge
                    label={u.isActive ? 'Kích hoạt' : 'Ngưng'}
                    cls={u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                  />
                </div>
                <div className="text-xs font-semibold text-ink-primary">
                  {u.employee ? `${u.employee.code} — ${u.employee.fullName}` : u.fullName}
                </div>
                <div className="text-[11px] text-ink-secondary">
                  {u.employee?.department?.name || u.department?.name || 'Toàn công ty'}
                  {(u.employee?.email || u.email) ? ` · ${u.employee?.email || u.email}` : ''}
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.userRoles?.map((ur: any) => (
                    <Badge key={ur.id} label={ur.role?.name} cls="bg-brand-soft text-brand border-sky-200" />
                  ))}
                </div>
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={togglingId === u.id}
                    onClick={() => handleToggle(u)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    {u.isActive ? 'Chuyển Ngưng' : 'Kích hoạt lại'}
                  </button>
                  <button onClick={() => openEdit(u)} className="btn-secondary px-2 py-1 text-xs">
                    <Pencil className="w-3.5 h-3.5" /> Sửa
                  </button>
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
                <th className="th-cell">Tài khoản</th>
                <th className="th-cell">Nhân viên liên kết</th>
                <th className="th-cell">Phòng ban</th>
                <th className="th-cell">Email</th>
                <th className="th-cell">Vai trò</th>
                <th className="th-cell">Đăng nhập gần nhất</th>
                <th className="th-cell">Trạng thái</th>
                <th className="th-cell text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold text-brand">{u.username}</td>
                  <td className="td-cell text-xs">
                    {u.employee ? (
                      <div>
                        <span className="font-mono font-semibold text-brand mr-1.5">{u.employee.code}</span>
                        <span className="font-medium text-ink-primary">{u.employee.fullName}</span>
                      </div>
                    ) : (
                      <div className="font-medium text-ink-primary">{u.fullName}</div>
                    )}
                  </td>
                  <td className="td-cell text-xs">{u.employee?.department?.name || u.department?.name || '—'}</td>
                  <td className="td-cell text-xs text-ink-muted">{u.employee?.email || u.email || '—'}</td>
                  <td className="td-cell text-xs">
                    {u.userRoles?.map((ur: any) => (
                      <Badge key={ur.id} label={ur.role?.name} cls="bg-brand-soft text-brand border-sky-200 mr-1" />
                    ))}
                  </td>
                  <td className="td-cell text-xs text-ink-secondary">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="td-cell">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.isActive}
                        disabled={togglingId === u.id}
                        onClick={() => handleToggle(u)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 ${
                          u.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={u.isActive ? 'Chuyển sang Ngưng' : 'Chuyển sang Kích hoạt'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            u.isActive ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`text-xs font-medium ${u.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                        {u.isActive ? 'Kích hoạt' : 'Ngưng'}
                      </span>
                    </div>
                  </td>
                  <td className="td-cell text-right">
                    <button onClick={() => openEdit(u)} className="btn-secondary px-2 py-1 text-xs" title="Chỉnh sửa tài khoản">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Chỉnh sửa tài khoản — ${editing.username}` : 'Tạo tài khoản người dùng mới'} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}

          {/* 1 & 2: Tài khoản | Mật khẩu */}
          {!editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label-field">Tài khoản <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-field font-mono"
                  placeholder="Nhập tên đăng nhập"
                />
              </div>
              <div>
                <label className="label-field">Mật khẩu <span className="text-red-500">*</span></label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field"
                  placeholder="Nhập mật khẩu đăng nhập"
                />
              </div>
            </div>
          )}

          {/* 3: Nhân viên (nhập tên để tìm kiếm & tự load thông tin phòng ban) */}
          <div ref={empBoxRef} className="relative">
            <label className="label-field">
              Nhân viên {!editing && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={empQuery}
                onFocus={() => setEmpDropdownOpen(true)}
                onChange={(e) => {
                  setEmpQuery(e.target.value);
                  setEmpDropdownOpen(true);
                  if (form.employeeId) setForm((prev) => ({ ...prev, employeeId: '' }));
                }}
                className="input-field pl-9 pr-8"
                placeholder="Nhập mã hoặc tên nhân viên để tìm..."
                autoComplete="off"
              />
              {(empQuery || form.employeeId) && (
                <button
                  type="button"
                  onClick={handleClearEmployee}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title="Xóa lựa chọn"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {empDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line bg-white shadow-lg divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-ink-muted text-center">
                    {employees.length === 0
                      ? 'Chưa có nhân viên nào trong Danh mục Nhân viên.'
                      : 'Không tìm thấy nhân viên phù hợp.'}
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const deptLabel = emp.department?.name || deptNameById.get(emp.departmentId) || 'Chưa gán phòng ban';
                    const isPicked = emp.id === form.employeeId;
                    return (
                      <button
                        type="button"
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-sky-50/70 transition-colors flex items-center justify-between gap-2 ${
                          isPicked ? 'bg-[#DFF1F8]' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink-primary truncate">
                            <span className="font-mono font-semibold text-brand mr-1.5">{emp.code}</span>
                            {emp.fullName}
                          </div>
                          <div className="text-[11px] text-ink-muted truncate">
                            {deptLabel}{emp.title ? ` · ${emp.title}` : ''}
                          </div>
                        </div>
                        {emp.email && <span className="text-[11px] text-ink-muted shrink-0 hidden sm:inline">{emp.email}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {selectedEmployee && (
              <div className="mt-2 p-2.5 rounded-lg bg-sky-50/70 border border-sky-200/80 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-secondary">
                <span className="inline-flex items-center gap-1 font-medium text-ink-primary">
                  <UserCheck className="w-3.5 h-3.5 text-brand" />
                  {selectedEmployee.code} — {selectedEmployee.fullName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-brand" />
                  Phòng ban: <strong className="text-ink-primary">{selectedDeptName}</strong>
                </span>
                {selectedEmployee.email && <span>Email: {selectedEmployee.email}</span>}
              </div>
            )}
          </div>

          {/* 4: Vai trò */}
          {!editing && (
            <div>
              <label className="label-field">Vai trò <span className="text-red-500">*</span></label>
              <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="input-field">
                <option value="">-- Chọn vai trò --</option>
                {(meta.roles || []).map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {editing && !selectedEmployee && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label-field">Họ và tên <span className="text-red-500">*</span></label>
                <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" placeholder="Nhập họ và tên" />
              </div>
              <div>
                <label className="label-field">Email <span className="text-red-500">*</span></label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="Nhập địa chỉ email" />
              </div>
            </div>
          )}

          <div className="p-3 rounded-md bg-slate-50 border border-line flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Trạng thái tài khoản</span>
            <div className="inline-flex items-center gap-2">
              <span className={`text-xs font-medium ${form.isActive ? 'text-emerald-700' : 'text-ink-muted'}`}>
                {form.isActive ? 'Kích hoạt' : 'Ngưng'}
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
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
