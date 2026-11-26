import React, { useEffect, useState } from 'react';
import { Plus, Search, Lock, Unlock } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';
import { formatDateTime } from '../../utils/format';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], roles: [] });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    title: '',
    password: '',
    roleId: '',
    departmentId: '',
    scopeType: 'DEPARTMENT',
  });

  const load = async () => {
    const [uRes, mRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/meta')]);
    setUsers(uRes.data);
    setMeta(mRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    await api.post('/admin/users', form);
    setOpen(false);
    setForm({ username: '', email: '', fullName: '', title: '', password: '', roleId: '', departmentId: '', scopeType: 'DEPARTMENT' });
    setMsg('Đã tạo người dùng mới thành công.');
    load();
  };

  const handleToggle = async (u: any) => {
    await api.patch(`/admin/users/${u.id}/active`, { isActive: !u.isActive });
    load();
  };

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý Người dùng"
        subtitle="Quản lý tài khoản đăng nhập nội bộ, đơn vị công tác, trạng thái hoạt động và phạm vi dữ liệu."
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Tạo người dùng
          </button>
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}

      <div className="panel p-3.5 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo username, họ tên, email..." className="input-field pl-9" />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Tài khoản</th>
                <th className="th-cell">Họ tên & Email</th>
                <th className="th-cell">Phòng ban</th>
                <th className="th-cell">Vai trò & Phạm vi</th>
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
                    <div className="font-medium text-ink-primary">{u.fullName}</div>
                    <div className="text-ink-muted">{u.email}</div>
                  </td>
                  <td className="td-cell text-xs">{u.department?.name || '—'}</td>
                  <td className="td-cell text-xs">
                    {u.userRoles?.map((ur: any) => (
                      <Badge key={ur.id} label={`${ur.role?.name} (${ur.scopeType})`} cls="bg-brand-soft text-brand border-sky-200 mr-1" />
                    ))}
                  </td>
                  <td className="td-cell text-xs text-ink-secondary">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="td-cell">
                    <Badge
                      label={u.isActive ? 'Hoạt động' : 'Đã khóa'}
                      cls={u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}
                    />
                  </td>
                  <td className="td-cell text-right">
                    <button onClick={() => handleToggle(u)} className="btn-secondary px-2 py-1 text-xs" title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}>
                      {u.isActive ? <Lock className="w-3.5 h-3.5 text-amber-700" /> : <Unlock className="w-3.5 h-3.5 text-emerald-700" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo tài khoản người dùng mới" maxWidth="max-w-xl">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label-field">Username <span className="text-red-500">*</span></label><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input-field font-mono" placeholder="Nhập tên đăng nhập" /></div>
            <div><label className="label-field">Mật khẩu mặc định</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" placeholder="Nhập mật khẩu khởi tạo" /></div>
            <div><label className="label-field">Họ và tên <span className="text-red-500">*</span></label><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" placeholder="Nhập họ và tên" /></div>
            <div><label className="label-field">Email <span className="text-red-500">*</span></label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="Nhập địa chỉ email" /></div>
            <div>
              <label className="label-field">Vai trò RBAC <span className="text-red-500">*</span></label>
              <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="input-field">
                <option value="">-- Chọn vai trò --</option>
                {meta.roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Phạm vi phân quyền</label>
              <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })} className="input-field">
                <option value="ORGANIZATION">Toàn công ty</option>
                <option value="DEPARTMENT">Theo phòng ban</option>
              </select>
            </div>
            <div>
              <label className="label-field">Phòng ban</label>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="input-field">
                <option value="">-- Chọn phòng ban --</option>
                {meta.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="label-field">Chức danh</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Tạo tài khoản</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
