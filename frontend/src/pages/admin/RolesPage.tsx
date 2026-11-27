import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Check,
  Minus,
  Plus,
  Pencil,
  Trash2,
  Save,
  AlertCircle,
  Lock,
  CheckSquare,
  Square,
  Users,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';

interface MatrixRowSpec {
  key: string;
  label: string;
  read?: string;
  create?: string;
  update?: string;
  delete?: string;
  specials?: Array<{ code: string; shortLabel: string }>;
}

const MATRIX_ROWS: MatrixRowSpec[] = [
  { key: 'dashboard', label: 'Tổng quan (Dashboard)', read: 'dashboard.read' },
  {
    key: 'discovery',
    label: 'Khám phá thiết bị & LAN',
    read: 'discovery.read',
    create: 'discovery.scan',
    delete: 'discovery.delete',
    specials: [{ code: 'discovery.approve', shortLabel: 'Duyệt thiết bị' }],
  },
  {
    key: 'assets',
    label: 'Quản lý tài sản',
    read: 'assets.read',
    create: 'assets.create',
    update: 'assets.update',
    delete: 'assets.delete',
    specials: [
      { code: 'assets.edit_code', shortLabel: 'Đổi mã' },
      { code: 'assets.documents', shortLabel: 'Hồ sơ' },
    ],
  },
  {
    key: 'transfers',
    label: 'Bàn giao & Điều chuyển',
    read: 'transfers.read',
    create: 'transfers.create',
    update: 'transfers.update',
    delete: 'transfers.delete',
  },
  {
    key: 'maintenance',
    label: 'Bảo trì, Sửa chữa & Thanh lý',
    read: 'maintenance.read',
    create: 'maintenance.create',
    update: 'maintenance.update',
    delete: 'maintenance.delete',
  },
  {
    key: 'inventory',
    label: 'Kiểm kê tài sản',
    read: 'inventory.read',
    create: 'inventory.create',
    update: 'inventory.update',
    delete: 'inventory.delete',
  },
  { key: 'software', label: 'Phần mềm & License', read: 'software.read' },
  {
    key: 'alerts',
    label: 'Cảnh báo & Thay đổi cấu hình',
    read: 'alerts.read',
    update: 'alerts.update',
    specials: [{ code: 'alerts.verify', shortLabel: 'Duyệt Baseline' }],
  },
  {
    key: 'reports',
    label: 'Báo cáo quản trị',
    read: 'reports.read',
    specials: [{ code: 'reports.export', shortLabel: 'Xuất file' }],
  },
  {
    key: 'catalogs',
    label: 'Danh mục (Phòng ban, Nhóm, Loại, Vị trí, NCC)',
    read: 'catalogs.read',
    create: 'catalogs.create',
    update: 'catalogs.update',
    delete: 'catalogs.delete',
  },
  {
    key: 'users',
    label: 'Người dùng & Phân quyền',
    read: 'users.read',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  {
    key: 'settings',
    label: 'Cấu hình hệ thống & Agent',
    read: 'settings.read',
    create: 'settings.create',
    update: 'settings.update',
    delete: 'settings.delete',
  },
  { key: 'audit', label: 'Nhật ký hệ thống (Audit Log)', read: 'admin.audit' },
];

export const RolesPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = !!user?.roles?.includes('SYSTEM_ADMIN');

  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // Create / Edit Role Info Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [modalSaving, setModalSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const permByCode = new Map<string, any>(permissions.map((p) => [p.code, p]));

  const syncSelectedPerms = (role: any) => {
    if (!role) {
      setSelectedPermIds(new Set());
      setDirty(false);
      return;
    }
    const ids = (role.permissions || [])
      .map((rp: any) => rp.permissionId || rp.permission?.id)
      .filter(Boolean);
    setSelectedPermIds(new Set(ids));
    setDirty(false);
  };

  const load = async (keepRoleId?: string) => {
    const res = await api.get('/admin/meta');
    const fetchedRoles = res.data.roles || [];
    const fetchedPerms = res.data.permissions || [];
    setRoles(fetchedRoles);
    setPermissions(fetchedPerms);

    const targetId = keepRoleId || selectedRoleId;
    const matched = fetchedRoles.find((r: any) => r.id === targetId) || fetchedRoles[0] || null;
    if (matched) {
      setSelectedRoleId(matched.id);
      syncSelectedPerms(matched);
    } else {
      setSelectedRoleId('');
      syncSelectedPerms(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;
  const isCoreSuper = selectedRole?.code === 'SYSTEM_ADMIN';

  const handleSelectRole = (role: any) => {
    if (dirty && !window.confirm('Bạn có thay đổi phân quyền chưa lưu. Bỏ qua thay đổi và chuyển nhóm quyền?')) {
      return;
    }
    setFeedback(null);
    setSelectedRoleId(role.id);
    syncSelectedPerms(role);
  };

  const togglePermByCode = (code?: string) => {
    if (!code || !isSuperAdmin || isCoreSuper) return;
    const perm = permByCode.get(code);
    if (!perm) return;
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(perm.id)) next.delete(perm.id);
      else next.add(perm.id);
      return next;
    });
    setDirty(true);
  };

  const getRowPermIds = (row: MatrixRowSpec): string[] => {
    const codes = [row.read, row.create, row.update, row.delete, ...(row.specials || []).map((s) => s.code)].filter(
      Boolean,
    ) as string[];
    return codes.map((c) => permByCode.get(c)?.id).filter(Boolean) as string[];
  };

  const toggleRowAll = (row: MatrixRowSpec) => {
    if (!isSuperAdmin || isCoreSuper) return;
    const ids = getRowPermIds(row);
    if (ids.length === 0) return;
    const allChecked = ids.every((id) => selectedPermIds.has(id));
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (allChecked) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    setDirty(true);
  };

  const handleSelectAll = () => {
    if (!isSuperAdmin || isCoreSuper) return;
    setSelectedPermIds(new Set(permissions.map((p) => p.id)));
    setDirty(true);
  };

  const handleClearAll = () => {
    if (!isSuperAdmin || isCoreSuper) return;
    setSelectedPermIds(new Set());
    setDirty(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole || !isSuperAdmin || isCoreSuper) return;
    setSavingPerms(true);
    setFeedback(null);
    try {
      await api.patch(`/admin/roles/${selectedRole.id}`, {
        permissionIds: Array.from(selectedPermIds),
      });
      setFeedback({
        type: 'ok',
        text: `Đã lưu phân quyền cho nhóm "${selectedRole.name}" (${selectedPermIds.size} quyền) và ghi Audit Log.`,
      });
      await load(selectedRole.id);
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.response?.data?.message || 'Không thể lưu phân quyền.' });
    } finally {
      setSavingPerms(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setForm({ code: '', name: '', description: '' });
    setFormErr('');
    setModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, role: any) => {
    e.stopPropagation();
    setEditingRole(role);
    setForm({ code: role.code, name: role.name, description: role.description || '' });
    setFormErr('');
    setModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    setFeedback(null);
    setModalSaving(true);
    try {
      if (editingRole) {
        await api.patch(`/admin/roles/${editingRole.id}`, {
          name: form.name,
          description: form.description,
        });
        setModalOpen(false);
        setFeedback({ type: 'ok', text: `Đã cập nhật thông tin nhóm quyền "${form.name.trim()}".` });
        await load(editingRole.id);
      } else {
        const res = await api.post('/admin/roles', {
          code: form.code,
          name: form.name,
          description: form.description,
          permissionIds: [],
        });
        setModalOpen(false);
        setFeedback({
          type: 'ok',
          text: `Đã tạo nhóm quyền "${form.name.trim()}". Hãy tích chọn quyền ở khung bên phải và bấm Lưu phân quyền.`,
        });
        await load(res.data?.id);
      }
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Không thể lưu nhóm quyền.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteRole = async (e: React.MouseEvent, role: any) => {
    e.stopPropagation();
    if (!window.confirm(`Xác nhận xóa nhóm quyền "${role.name}"?`)) return;
    setFeedback(null);
    try {
      await api.delete(`/admin/roles/${role.id}`);
      setFeedback({ type: 'ok', text: `Đã xóa nhóm quyền "${role.name}".` });
      await load(selectedRoleId === role.id ? undefined : selectedRoleId);
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.response?.data?.message || 'Không thể xóa nhóm quyền.' });
    }
  };

  const renderActionCell = (code?: string) => {
    if (!code) {
      return <span className="text-slate-300 select-none">—</span>;
    }
    const perm = permByCode.get(code);
    if (!perm) return <span className="text-slate-300 select-none">—</span>;
    const checked = isCoreSuper || selectedPermIds.has(perm.id);

    if (isSuperAdmin) {
      if (isCoreSuper) {
        return (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-400"
            title="Super Admin luôn có toàn quyền hệ thống"
          >
            <Lock className="w-3.5 h-3.5" />
          </span>
        );
      }
      return (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => togglePermByCode(code)}
          title={perm.name}
          aria-label={perm.name}
          className="w-4 h-4 accent-brand cursor-pointer align-middle"
        />
      );
    }

    return checked ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700" title={perm.name}>
        <Check className="w-3.5 h-3.5" />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-6 h-6 text-slate-300">
        <Minus className="w-3.5 h-3.5" />
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phân quyền hệ thống (RBAC)"
        subtitle="Chọn nhóm quyền bên trái để thiết lập ma trận quyền Xem / Thêm / Sửa / Xóa / Duyệt ở khung bên phải."
        actions={
          isSuperAdmin && (
            <button onClick={openCreateModal} className="btn-primary">
              <Plus className="w-4 h-4" /> Tạo nhóm quyền
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

      {/* Split Layout 2:8 */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
        {/* LEFT PANEL (2/10): Danh sách nhóm quyền */}
        <div className="lg:col-span-2 panel overflow-hidden">
          <div className="px-4 h-[76px] border-b border-line bg-slate-50/50 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-primary truncate">Danh sách nhóm quyền</h2>
              <Badge label={`${roles.length}`} cls="bg-brand-soft text-brand border-sky-200" />
            </div>
            <p className="text-xs text-ink-secondary mt-1 truncate">Chọn nhóm để phân quyền</p>
          </div>

          <div className="px-4 py-2.5 bg-rail text-white border-b border-rail flex items-center justify-between text-xs font-medium">
            <span>Tên nhóm quyền</span>
            {isSuperAdmin && <span>Thao tác</span>}
          </div>

          <div className="divide-y divide-slate-100">
            {roles.map((r, idx) => {
              const isSelected = r.id === selectedRoleId;
              const isRoleSuper = r.code === 'SYSTEM_ADMIN';
              const permCount = isRoleSuper ? permissions.length : r.permissions?.length ?? 0;
              const zebraBg = idx % 2 === 1 ? 'bg-[#F2F9FC]' : 'bg-white';

              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectRole(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelectRole(r);
                  }}
                  className={`relative px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#DFF1F8]' : `${zebraBg} hover:bg-[#E6F4F9]`
                  }`}
                >
                  {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-rail" />}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className={`text-sm truncate ${isSelected ? 'font-semibold text-brand' : 'font-medium text-ink-primary'}`}>
                        {r.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-ink-muted">
                        <span className="tabular-nums">{permCount} quyền</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-0.5 tabular-nums">
                          <Users className="w-3 h-3" /> {r._count?.userRoles ?? 0}
                        </span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(e, r)}
                          className="p-1 text-slate-400 hover:text-brand hover:bg-white rounded"
                          title="Sửa thông tin nhóm quyền"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isRoleSuper && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRole(e, r)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded"
                            title="Xóa nhóm quyền"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL (8/10): Ma trận phân quyền theo nhóm chức năng x hành động */}
        <div className="lg:col-span-8 panel overflow-hidden">
          {selectedRole ? (
            <>
              <div className="px-5 h-[76px] border-b border-line flex items-center justify-between gap-3 bg-slate-50/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                    <h2 className="text-base font-semibold text-ink-primary truncate">{selectedRole.name}</h2>
                    <span className="font-mono text-xs text-ink-muted">({selectedRole.code})</span>
                    <Badge
                      label={`${isCoreSuper ? permissions.length : selectedPermIds.size} / ${permissions.length} quyền`}
                      cls="bg-brand-soft text-brand border-sky-200"
                    />
                    {dirty && <Badge label="Chưa lưu" cls="bg-amber-50 text-amber-800 border-amber-200" />}
                  </div>
                  <p
                    className="text-xs text-ink-secondary mt-1 truncate"
                    title={selectedRole.description || undefined}
                  >
                    {selectedRole.description || 'Chọn các quyền Xem / Thêm / Sửa / Xóa cho nhóm quyền này.'}
                  </p>
                </div>

                {isSuperAdmin && !isCoreSuper && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button type="button" onClick={handleSelectAll} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <CheckSquare className="w-3.5 h-3.5" /> Chọn tất cả
                    </button>
                    <button type="button" onClick={handleClearAll} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <Square className="w-3.5 h-3.5" /> Bỏ chọn
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePermissions}
                      disabled={!dirty || savingPerms}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingPerms ? 'Đang lưu...' : 'Lưu phân quyền'}
                    </button>
                  </div>
                )}

                {isCoreSuper && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted bg-white border border-line px-2.5 py-1 rounded shrink-0">
                    <Lock className="w-3.5 h-3.5" /> Toàn quyền mặc định
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th-cell w-12 px-2 text-center">STT</th>
                      <th className="th-cell">Chức năng / Phân hệ</th>
                      <th className="th-cell w-14 px-2 text-center">Xem</th>
                      <th className="th-cell w-14 px-2 text-center">Thêm</th>
                      <th className="th-cell w-14 px-2 text-center">Sửa</th>
                      <th className="th-cell w-14 px-2 text-center">Xóa</th>
                      <th className="th-cell px-2 text-center">Duyệt / Đặc biệt</th>
                      <th className="th-cell w-16 px-2 text-center">Tất cả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX_ROWS.map((row, idx) => {
                      const rowIds = getRowPermIds(row);
                      const rowAllChecked =
                        isCoreSuper || (rowIds.length > 0 && rowIds.every((id) => selectedPermIds.has(id)));

                      return (
                        <tr key={row.key}>
                          <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="td-cell text-sm font-medium text-ink-primary">{row.label}</td>
                          <td className="td-cell text-center">{renderActionCell(row.read)}</td>
                          <td className="td-cell text-center">{renderActionCell(row.create)}</td>
                          <td className="td-cell text-center">{renderActionCell(row.update)}</td>
                          <td className="td-cell text-center">{renderActionCell(row.delete)}</td>
                          <td className="td-cell">
                            {row.specials && row.specials.length > 0 ? (
                              <div className="flex items-center justify-center gap-3 flex-wrap">
                                {row.specials.map((sp) => {
                                  const perm = permByCode.get(sp.code);
                                  if (!perm) return null;
                                  const checked = isCoreSuper || selectedPermIds.has(perm.id);
                                  return (
                                    <label
                                      key={sp.code}
                                      title={perm.name}
                                      className={`inline-flex items-center gap-1.5 text-xs ${
                                        isSuperAdmin && !isCoreSuper ? 'cursor-pointer' : ''
                                      }`}
                                    >
                                      {isSuperAdmin ? (
                                        isCoreSuper ? (
                                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        ) : (
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => togglePermByCode(sp.code)}
                                            className="w-4 h-4 accent-brand cursor-pointer"
                                          />
                                        )
                                      ) : checked ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                                      ) : (
                                        <Minus className="w-3.5 h-3.5 text-slate-300" />
                                      )}
                                      <span className="text-ink-secondary whitespace-nowrap">{sp.shortLabel}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center text-slate-300 select-none">—</div>
                            )}
                          </td>
                          <td className="td-cell text-center">
                            {isSuperAdmin ? (
                              isCoreSuper ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-400">
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={rowAllChecked}
                                  onChange={() => toggleRowAll(row)}
                                  title={`Chọn tất cả quyền nhóm ${row.label}`}
                                  aria-label={`Tất cả quyền ${row.label}`}
                                  className="w-4 h-4 accent-brand cursor-pointer align-middle"
                                />
                              )
                            ) : rowAllChecked ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 text-slate-300">
                                <Minus className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-sm text-ink-muted">
              Chọn một nhóm quyền ở danh sách bên trái để thiết lập phân quyền.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tạo / Sửa thông tin nhóm quyền */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRole ? 'Chỉnh sửa thông tin nhóm quyền' : 'Tạo nhóm quyền mới'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleModalSubmit} className="space-y-3.5">
          {formErr && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErr}</span>
            </div>
          )}

          <div>
            <label className="label-field">
              Mã nhóm quyền <span className="text-red-500">*</span>
            </label>
            <input
              required
              disabled={!!editingRole}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              className="input-field font-mono disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Nhập mã nhóm quyền"
            />
          </div>
          <div>
            <label className="label-field">
              Tên nhóm quyền <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Nhập tên nhóm quyền"
            />
          </div>
          <div>
            <label className="label-field">Mô tả</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field"
              placeholder="Nhập mô tả nhóm quyền"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={modalSaving} className="btn-primary">
              {modalSaving ? 'Đang lưu...' : editingRole ? 'Lưu thay đổi' : 'Tạo nhóm quyền'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
