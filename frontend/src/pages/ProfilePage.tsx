import React, { useEffect, useState } from 'react';
import {
  Camera,
  Save,
  KeyRound,
  Mail,
  Phone,
  User as UserIcon,
  Building2,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Badge, PageHeader } from '../components/UiPrimitives';
import { formatDateTime } from '../utils/format';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ProfilePage: React.FC = () => {
  const { user, updateLocalUser } = useAuth();

  const [form, setForm] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!profileNotice) return;
    const t = setTimeout(() => setProfileNotice(null), 3000);
    return () => clearTimeout(t);
  }, [profileNotice]);

  useEffect(() => {
    if (!pwdNotice) return;
    const t = setTimeout(() => setPwdNotice(null), 3000);
    return () => clearTimeout(t);
  }, [pwdNotice]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const res = await api.patch('/auth/profile', form);
      updateLocalUser(res.data);
      setProfileNotice({ type: 'success', text: 'Đã cập nhật thông tin tài khoản thành công.' });
    } catch (err: any) {
      setProfileNotice({
        type: 'error',
        text: err.response?.data?.message || 'Không thể cập nhật thông tin tài khoản.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setProfileNotice({ type: 'error', text: 'Ảnh đại diện vượt quá giới hạn 20MB.' });
      return;
    }
    setUploadingAvatar(true);
    setProfileNotice(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.user) updateLocalUser(res.data.user);
      setProfileNotice({ type: 'success', text: 'Đã cập nhật ảnh đại diện.' });
    } catch (err: any) {
      setProfileNotice({
        type: 'error',
        text: err.response?.data?.message || 'Không thể tải lên ảnh đại diện.',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await api.patch('/auth/profile', { avatarUrl: '' });
      updateLocalUser(res.data);
      setProfileNotice({ type: 'error', text: 'Đã xóa ảnh đại diện.' });
    } catch (err: any) {
      setProfileNotice({ type: 'error', text: err.response?.data?.message || 'Không thể xóa ảnh đại diện.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdNotice(null);
    if (pwdForm.newPassword.length < 6) {
      setPwdNotice({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdNotice({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setSavingPwd(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwdNotice({ type: 'success', text: 'Đổi mật khẩu thành công.' });
    } catch (err: any) {
      setPwdNotice({
        type: 'error',
        text: err.response?.data?.message || 'Không thể đổi mật khẩu.',
      });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thông tin tài khoản"
        subtitle="Quản lý hồ sơ cá nhân, ảnh đại diện, thông tin liên hệ và bảo mật đăng nhập."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: THẺ HỒ SƠ & AVATAR */}
        <div className="lg:col-span-4 space-y-4">
          <div className="panel p-5 flex flex-col items-center text-center">
            <div className="relative group">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-rail text-white text-2xl font-bold flex items-center justify-center shadow-sm">
                  {getInitials(user?.fullName)}
                </div>
              )}

              <label
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand hover:bg-brand-hover text-white flex items-center justify-center shadow cursor-pointer transition-colors"
                title="Đổi ảnh đại diện"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarChange}
                />
              </label>
            </div>

            <h2 className="mt-3.5 text-base font-bold text-ink-primary">{user?.fullName}</h2>
            <p className="text-xs font-mono text-ink-muted mt-0.5">@{user?.username}</p>
            {user?.title && <p className="text-xs text-ink-secondary mt-1">{user.title}</p>}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {(user?.roleNames?.length ? user.roleNames : user?.roles || []).map((r) => (
                <Badge key={r} label={r} cls="bg-brand-soft text-brand border-sky-200" />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <label className="btn-secondary px-3 py-1.5 text-xs cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                {uploadingAvatar ? 'Đang tải...' : 'Đổi ảnh đại diện'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarChange}
                />
              </label>
              {user?.avatarUrl && (
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={handleRemoveAvatar}
                  className="btn-secondary px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  title="Xóa ảnh đại diện"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-ink-muted mt-2">Hỗ trợ PNG, JPG, WEBP, SVG (tối đa 20MB)</p>

            <div className="w-full mt-5 pt-4 border-t border-line space-y-2.5 text-left text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted inline-flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Phòng ban
                </span>
                <span className="font-medium text-ink-primary truncate">{user?.departmentName || 'Toàn công ty'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Quyền hạn
                </span>
                <span className="font-mono text-ink-secondary">{user?.permissions?.length || 0} quyền</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Đăng nhập gần nhất
                </span>
                <span className="font-mono text-ink-secondary">
                  {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CẬP NHẬT THÔNG TIN & ĐỔI MẬT KHẨU */}
        <div className="lg:col-span-8 space-y-5">
          {/* Card 1: Thông tin cơ bản */}
          <form onSubmit={handleSaveProfile} className="panel p-4 sm:p-5 space-y-4">
            <div className="pb-3 border-b border-line">
              <h3 className="text-sm font-semibold text-ink-primary">Thông tin cơ bản</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Họ tên và phòng ban được đồng bộ theo hồ sơ nhân viên. Bạn có thể cập nhật email và số điện thoại liên hệ.
              </p>
            </div>

            {profileNotice && (
              <div
                className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center gap-2 ${
                  profileNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {profileNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{profileNotice.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Tên đăng nhập</label>
                <input disabled value={user?.username || ''} className="input-field font-mono bg-slate-50 text-ink-muted" />
              </div>
              <div>
                <label className="label-field">Phòng ban</label>
                <input disabled value={user?.departmentName || 'Toàn công ty'} className="input-field bg-slate-50 text-ink-muted" />
              </div>
              <div>
                <label className="label-field">Họ và tên (theo hồ sơ nhân viên)</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    disabled
                    value={user?.fullName || ''}
                    className="input-field pl-9 bg-slate-50 text-ink-muted"
                  />
                </div>
              </div>
              <div>
                <label className="label-field">Chức danh</label>
                <input
                  disabled
                  value={user?.title || '—'}
                  className="input-field bg-slate-50 text-ink-muted"
                />
              </div>
              <div>
                <label className="label-field">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field pl-9"
                    placeholder="Nhập địa chỉ email"
                  />
                </div>
              </div>
              <div>
                <label className="label-field">Số điện thoại</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-field pl-9 font-mono"
                    placeholder="Nhập số điện thoại liên hệ"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                <Save className="w-4 h-4" />
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </form>

          {/* Card 2: Đổi mật khẩu */}
          <form onSubmit={handleChangePassword} className="panel p-4 sm:p-5 space-y-4">
            <div className="pb-3 border-b border-line flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand" />
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">Đổi mật khẩu đăng nhập</h3>
                <p className="text-xs text-ink-muted">Mật khẩu mới tối thiểu 6 ký tự để đảm bảo an toàn tài khoản.</p>
              </div>
            </div>

            {pwdNotice && (
              <div
                className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center gap-2 ${
                  pwdNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {pwdNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{pwdNotice.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label-field">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                <input
                  required
                  type="password"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  className="input-field"
                  placeholder="Nhập mật khẩu cũ"
                />
              </div>
              <div>
                <label className="label-field">Mật khẩu mới <span className="text-red-500">*</span></label>
                <input
                  required
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  className="input-field"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label className="label-field">Xác nhận mật khẩu mới <span className="text-red-500">*</span></label>
                <input
                  required
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className="input-field"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <button type="submit" disabled={savingPwd} className="btn-secondary">
                <KeyRound className="w-4 h-4" />
                {savingPwd ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
