import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DEMO_ACCOUNTS = [
  { username: 'sysadmin', role: 'System Admin', desc: 'Toàn quyền cấu hình & phân quyền' },
  { username: 'itadmin', role: 'IT Admin', desc: 'Duyệt tài sản, điều chuyển, xác minh Baseline' },
  { username: 'itstaff', role: 'IT Staff', desc: 'Nghiệp vụ vận hành CNTT' },
  { username: 'qaviewer', role: 'Department Viewer', desc: 'Chỉ xem tài sản Phòng QA' },
];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('sysadmin');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-5 bg-white border border-line rounded-xl overflow-hidden shadow-sm">
        {/* Left Brand Panel */}
        <div className="md:col-span-2 bg-rail text-white p-7 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-white/15 border border-white/20 text-xs font-normal text-white mb-6">
              <ShieldCheck className="w-4 h-4 text-white" />
              Mạng nội bộ (LAN)
            </div>
            <h1 className="text-xl font-semibold tracking-tight leading-snug">
              IT Asset Management
            </h1>
            <p className="text-sm text-white/85 mt-2 leading-relaxed">
              Hệ thống quản lý tập trung tài sản CNTT, kiểm kê tự động bằng Windows Agent và giám sát sai lệch cấu hình theo Baseline.
            </p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/15 space-y-2 text-xs text-white/75">
            <div className="flex justify-between">
              <span>Kiến trúc</span>
              <span className="text-white font-mono">NestJS + Prisma + React</span>
            </div>
            <div className="flex justify-between">
              <span>Endpoint Agent</span>
              <span className="text-white font-mono">.NET Worker Service</span>
            </div>
            <div className="flex justify-between">
              <span>Bảo mật</span>
              <span className="text-white">JWT + RBAC + Audit Log</span>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="md:col-span-3 p-7">
          <h2 className="text-lg font-semibold text-ink-primary">Đăng nhập hệ thống</h2>
          <p className="text-sm text-ink-secondary mt-0.5 mb-5">
            Sử dụng tài khoản quản trị hoặc nhân sự được phân quyền nội bộ.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-field">Tên đăng nhập <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-9"
                  placeholder="Nhập tên đăng nhập"
                />
              </div>
            </div>
            <div>
              <label className="label-field">Mật khẩu <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="Nhập mật khẩu"
                />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-line">
            <div className="text-xs font-medium text-ink-secondary mb-2.5">
              Tài khoản mẫu theo vai trò RBAC (Mật khẩu: <span className="font-mono text-ink-primary">Admin@123</span>)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword('Admin@123');
                  }}
                  className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                    username === acc.username
                      ? 'border-brand bg-brand-soft/60'
                      : 'border-line hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-ink-primary flex items-center justify-between">
                    <span>{acc.role}</span>
                    <span className="font-mono text-[11px] text-brand">{acc.username}</span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
