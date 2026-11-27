import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Cpu,
  Layers,
  FileCheck2,
  Server,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const branding = useBranding();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf4f9] via-[#f5f9fc] to-[#e1eff6] flex items-center justify-center p-4 sm:p-6">
      {/* Subtle architectural grid & ambient glow on page backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0, 110, 150, 0.16) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-28 w-96 h-96 rounded-full bg-[#006E96]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-cyan-500/15 blur-3xl"
      />

      {/* Main Split Card (Desktop) / Compact Single Card (Mobile) */}
      <div className="relative z-10 w-full max-w-[400px] md:max-w-[920px] grid md:grid-cols-12 bg-white rounded-2xl border border-sky-200/80 shadow-[0_24px_60px_-20px_rgba(0,90,125,0.22)] overflow-hidden">
        {/* Left Visual & Brand Panel — Desktop only */}
        <div className="hidden md:flex relative md:col-span-5 bg-gradient-to-br from-[#004f6d] via-[#006E96] to-[#0086b3] text-white p-8 flex-col justify-between overflow-hidden">
          {/* IT Infrastructure SVG Circuit / Network Topology Motif */}
          <svg
            aria-hidden="true"
            viewBox="0 0 420 520"
            fill="none"
            className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.14]"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="itam-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" stroke="white" strokeWidth="0.7" />
              </pattern>
            </defs>
            <rect width="420" height="520" fill="url(#itam-grid)" />
            {/* Connected endpoint nodes */}
            <circle cx="330" cy="95" r="78" stroke="white" strokeWidth="1.2" strokeDasharray="4 6" />
            <circle cx="330" cy="95" r="46" stroke="white" strokeWidth="1" />
            <circle cx="70" cy="430" r="95" stroke="white" strokeWidth="1.2" strokeDasharray="5 7" />
            <path
              d="M 40 160 L 130 160 L 175 205 L 330 205 M 175 205 L 175 340 L 295 340 M 295 340 L 355 400"
              stroke="white"
              strokeWidth="1.4"
            />
            <circle cx="130" cy="160" r="4" fill="white" />
            <circle cx="175" cy="205" r="5" fill="white" />
            <circle cx="330" cy="205" r="4" fill="white" />
            <circle cx="175" cy="340" r="4" fill="white" />
            <circle cx="295" cy="340" r="5" fill="white" />
            <circle cx="355" cy="400" r="4" fill="white" />
          </svg>

          {/* Soft glow orb */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-14 w-52 h-52 rounded-full bg-cyan-300/20 blur-2xl"
          />
          <Server
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -bottom-8 w-44 h-44 text-white/[0.07]"
            strokeWidth={1.2}
          />

          {/* Top Brand */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3">
              {branding.logoUrl ? (
                <div className="w-11 h-11 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                  <img src={branding.logoUrl} alt="Logo đơn vị" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-sm shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-wide text-white truncate">
                  {branding.name || 'IT Asset Mgmt'}
                </div>
                <div className="text-[11px] text-white/75">Quản lý tài sản CNTT</div>
              </div>
            </div>

            <h1 className="mt-8 text-2xl font-bold tracking-tight leading-snug text-white">
              Quản lý tài sản CNTT tập trung
            </h1>
            <p className="mt-2.5 text-sm text-white/80 leading-relaxed">
              Theo dõi toàn bộ vòng đời thiết bị, cấu hình phần cứng thực tế và hồ sơ chứng từ trong một nền tảng thống nhất.
            </p>

            {/* Key Capabilities */}
            <div className="mt-7 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/12 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Thu thập tự động Windows Agent</div>
                  <div className="text-[11px] text-white/70 mt-0.5">
                    Đồng bộ phần cứng, hệ điều hành &amp; phần mềm định kỳ
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/12 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Giám sát Baseline &amp; Cảnh báo</div>
                  <div className="text-[11px] text-white/70 mt-0.5">
                    Phát hiện tức thì thay đổi linh kiện và sai lệch cấu hình
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/12 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck2 className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Hồ sơ mua sắm &amp; Kiểm kê</div>
                  <div className="text-[11px] text-white/70 mt-0.5">
                    Quản lý chứng từ PR, PO, bàn giao, bảo trì và mã QR
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="relative z-10 mt-8 pt-5 border-t border-white/15 flex items-center justify-between text-[11px] text-white/70">
            <span>Hệ thống quản trị nội bộ</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Sẵn sàng
            </span>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            {/* Compact Mobile Logo & Title */}
            <div className="md:hidden flex flex-col items-center text-center mb-6">
              {branding.logoUrl ? (
                <div className="h-14 w-28 mb-2.5 flex items-center justify-center">
                  <img src={branding.logoUrl} alt="Logo đơn vị" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm mb-2.5">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              )}
              <h1 className="text-lg font-bold text-ink-primary tracking-tight">
                {branding.name || 'Quản lý tài sản CNTT'}
              </h1>
              <p className="text-xs text-ink-muted mt-0.5">Đăng nhập hệ thống</p>
            </div>

            {/* Desktop Heading */}
            <div className="hidden md:block mb-7">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef8fc] text-[#006E96] border border-sky-200/80 text-[11px] font-semibold mb-3">
                <Lock className="w-3 h-3" />
                Xác thực người dùng
              </span>
              <h2 className="text-2xl font-bold text-ink-primary tracking-tight">Đăng nhập hệ thống</h2>
              <p className="text-sm text-ink-secondary mt-1">
                Vui lòng nhập tài khoản được cấp để truy cập bảng điều khiển quản lý tài sản.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field pl-10 py-2.5"
                    placeholder="Nhập tên đăng nhập"
                  />
                </div>
              </div>

              <div>
                <label className="label-field">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10 py-2.5"
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-2.5 mt-2 text-sm font-semibold shadow-sm hover:shadow transition-all"
              >
                <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="hidden md:flex mt-8 pt-5 border-t border-line items-center justify-between text-xs text-ink-muted">
              <span>Bảo mật theo phân quyền RBAC</span>
              <span>Liên hệ bộ phận IT nếu cần cấp tài khoản</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
