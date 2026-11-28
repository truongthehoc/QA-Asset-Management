import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Plus, Package, Download, MonitorCheck, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useDialog } from '../../contexts/DialogContext';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';
import { formatDate } from '../../utils/format';

export const AgentManagementPage: React.FC = () => {
  const { confirm } = useDialog();
  const [tokens, setTokens] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [tokenForm, setTokenForm] = useState({ name: '', maxUses: '100', expiresDays: '30' });
  const [newRawToken, setNewRawToken] = useState('');
  const [verOpen, setVerOpen] = useState(false);
  const [verForm, setVerForm] = useState({ version: '', releaseNotes: '', downloadUrl: '', isLatest: true, isMandatory: false });
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // 1-Click Installer Download Form
  const defaultBackendUrl =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : window.location.origin;
  const [installerForm, setInstallerForm] = useState({
    backendUrl: defaultBackendUrl,
    enrollmentToken: '',
    allowSelfSignedCert: false,
  });
  const [selectedTokenId, setSelectedTokenId] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  const normalizeToken = (t: any) => {
    const isExpired =
      typeof t.isExpired === 'boolean'
        ? t.isExpired
        : Boolean(t.expiresAt && new Date(t.expiresAt).getTime() < Date.now());
    const isExhausted = Boolean(t.maxUses && Number(t.usedCount || 0) >= Number(t.maxUses));
    const isUsable =
      typeof t.isUsable === 'boolean'
        ? t.isUsable
        : !t.isRevoked && !isExpired && !isExhausted;
    return { ...t, isExpired, isExhausted, isUsable };
  };

  const load = async (preserveToken?: { id: string; rawToken: string }) => {
    const [tRes, vRes] = await Promise.all([api.get('/agents/tokens'), api.get('/agents/versions')]);
    const tokenList: any[] = (tRes.data || []).map(normalizeToken);
    setTokens(tokenList);
    setVersions(vRes.data || []);

    if (preserveToken?.rawToken) {
      setSelectedTokenId(preserveToken.id);
      setInstallerForm((prev) => ({ ...prev, enrollmentToken: preserveToken.rawToken }));
      return;
    }

    // Auto-select first active usable token if none selected or previously selected was revoked
    const activeUsable = tokenList.filter((t) => t.isUsable && t.tokenValue);
    setInstallerForm((prev) => {
      const stillValid = activeUsable.some((t) => t.tokenValue === prev.enrollmentToken);
      if (stillValid && prev.enrollmentToken) return prev;
      const first = activeUsable[0];
      if (first) {
        setSelectedTokenId(first.id);
        return { ...prev, enrollmentToken: first.tokenValue };
      }
      setSelectedTokenId('');
      return { ...prev, enrollmentToken: '' };
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 3000);
    return () => window.clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (!errMsg) return;
    const t = window.setTimeout(() => setErrMsg(''), 3000);
    return () => window.clearTimeout(t);
  }, [errMsg]);

  const handleSelectTokenRow = (t: any) => {
    setErrMsg('');
    if (!t.isUsable) {
      setErrMsg(`Token "${t.name}" đã thu hồi, hết hạn hoặc hết lượt sử dụng — không thể dùng để cài mới.`);
      return;
    }
    if (!t.tokenValue) {
      setErrMsg(`Token "${t.name}" được tạo trước khi bật tính năng chọn nhanh. Hãy dán mã đã lưu hoặc tạo Token mới.`);
      return;
    }
    setSelectedTokenId(t.id);
    setInstallerForm((f) => ({ ...f, enrollmentToken: t.tokenValue }));
    setMsg(`Đã nạp mã Token từ đợt "${t.name}" lên khung tải bộ cài.`);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErrMsg('');
    const res = await api.post('/agents/tokens', {
      name: tokenForm.name.trim(),
      maxUses: tokenForm.maxUses ? Number(tokenForm.maxUses) : undefined,
      expiresDays: Number(tokenForm.expiresDays) || 30,
    });
    setNewRawToken(res.data.rawToken);
    setTokenForm({ name: '', maxUses: '100', expiresDays: '30' });
    load({ id: res.data.id || '', rawToken: res.data.rawToken });
  };

  const handleDownloadInstaller = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErrMsg('');
    setDownloading(true);
    try {
      const res = await api.post('/agents/download-installer', installerForm, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ITAssetAgent-Setup.bat';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Đã tải file cài đặt 1-Click (ITAssetAgent-Setup.bat). Chạy file này trên máy Windows bằng quyền Administrator để cài đặt.');
    } catch (err: any) {
      setErrMsg(err.response?.data?.message || 'Không thể tạo file cài đặt Agent.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    const ok = await confirm({
      title: 'Thu hồi Enrollment Token',
      message: 'Xác nhận thu hồi Enrollment Token này? Các Agent mới sẽ không thể dùng token này để đăng ký nữa.',
      confirmLabel: 'Thu hồi Token',
      tone: 'danger',
    });
    if (!ok) return;
    await api.patch(`/agents/tokens/${id}/revoke`);
    setMsg('');
    setErrMsg('Đã thu hồi Enrollment Token.');
    load();
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/agents/versions', verForm);
    setVerOpen(false);
    setVerForm({ version: '', releaseNotes: '', downloadUrl: '', isLatest: true, isMandatory: false });
    setMsg('Đã phát hành thông tin phiên bản Windows Agent mới.');
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý Phiên bản Agent & Enrollment Token"
        subtitle="Cấp phát Enrollment Token có thời hạn/giới hạn lượt cho triển khai GPO và quản lý vòng đời phiên bản bộ cài MSI Windows Agent."
        actions={
          <button onClick={() => setVerOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Phát hành phiên bản Agent
          </button>
        }
      />

      {msg && <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</div>}
      {errMsg && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* 1-Click Pre-configured Windows Agent Downloader */}
      <div className="panel p-5 space-y-4 bg-gradient-to-br from-[#eef8fc]/70 via-white to-white border-sky-200/80">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 text-ink-primary">
              <MonitorCheck className="w-4 h-4 text-brand" /> Tải bộ cài Windows Agent 1-Click (Chạy ngay — không cần .NET/Node)
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Sinh sẵn file <code className="font-mono text-brand">ITAssetAgent-Setup.bat</code> đã nhúng URL máy chủ &amp; Enrollment Token. Khi chạy trên Windows 10/11/Server sẽ tự cài dịch vụ chạy ngầm, biểu tượng khay hệ thống (System Tray) và đồng bộ ngay.
            </p>
          </div>
          <Badge label="PowerShell Native v1.3.0" cls="bg-brand-soft text-brand border-sky-200" />
        </div>

        <form onSubmit={handleDownloadInstaller} className="grid sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="label-field">URL Máy chủ Backend <span className="text-red-500">*</span></label>
            <input
              required
              value={installerForm.backendUrl}
              onChange={(e) => setInstallerForm({ ...installerForm, backendUrl: e.target.value })}
              className="input-field font-mono text-xs"
              placeholder="Nhập địa chỉ URL máy chủ"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="label-field">Enrollment Token <span className="text-red-500">*</span></label>
            <input
              required
              value={installerForm.enrollmentToken}
              onChange={(e) => setInstallerForm({ ...installerForm, enrollmentToken: e.target.value })}
              className="input-field font-mono text-xs"
              placeholder="Nhập hoặc tạo mới Enrollment Token bên dưới"
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={downloading} className="btn-primary w-full">
              <Download className="w-4 h-4" />
              {downloading ? 'Đang tạo bộ cài...' : 'Tải file cài đặt (.bat)'}
            </button>
          </div>
          <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <label className="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={installerForm.allowSelfSignedCert}
                onChange={(e) => setInstallerForm({ ...installerForm, allowSelfSignedCert: e.target.checked })}
              />
              <span>Cho phép chứng chỉ SSL tự ký (Self-signed CA nội bộ)</span>
            </label>
            <span className="text-[11px] text-ink-muted">
              File cấu hình sau cài đặt: <code className="font-mono">C:\ProgramData\ITAssetAgent\config.json</code>
            </span>
          </div>
        </form>
      </div>

      {/* Enrollment Tokens */}
      <div className="panel p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brand" /> Enrollment Token (Đăng ký Windows Agent)
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Theo SRS Mục 4.4: Không nhúng bí mật dùng chung bất biến vào bộ cài MSI; dùng Token có thời hạn và khả năng thu hồi.
          </p>
        </div>

        <form onSubmit={handleCreateToken} className="grid sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-6">
            <label className="label-field">Tên đợt triển khai <span className="text-red-500">*</span></label>
            <input required value={tokenForm.name} onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })} placeholder="Nhập tên đợt triển khai" className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Lượt tối đa</label>
            <input type="number" value={tokenForm.maxUses} onChange={(e) => setTokenForm({ ...tokenForm, maxUses: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Hiệu lực (ngày)</label>
            <input type="number" value={tokenForm.expiresDays} onChange={(e) => setTokenForm({ ...tokenForm, expiresDays: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary w-full">Tạo Token</button>
          </div>
        </form>

        {newRawToken && (
          <div className="p-3.5 rounded-md bg-amber-50 border border-amber-300 text-xs space-y-1.5">
            <div className="font-semibold text-amber-900">Sao chép Enrollment Token ngay (chỉ hiển thị duy nhất 1 lần):</div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-amber-200 select-all">{newRawToken}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(newRawToken)} className="btn-secondary px-2.5 py-1.5 text-xs">
                <Copy className="w-3.5 h-3.5" /> Sao chép
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Tên đợt triển khai</th>
                <th className="th-cell">Mã hiển thị</th>
                <th className="th-cell">Đã dùng / Tối đa</th>
                <th className="th-cell">Hết hạn</th>
                <th className="th-cell">Trạng thái</th>
                <th className="th-cell text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, idx) => {
                const isSelected = selectedTokenId === t.id && t.isUsable;
                const statusLabel = t.isRevoked
                  ? 'Đã thu hồi'
                  : t.isExpired
                    ? 'Hết hạn'
                    : !t.isUsable
                      ? 'Hết lượt'
                      : 'Hiệu lực';
                const statusCls = t.isUsable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200';
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleSelectTokenRow(t)}
                    title={t.isUsable ? 'Nhấn để nạp mã Token này lên khung tải bộ cài' : undefined}
                    className={`transition-colors ${
                      t.isUsable ? 'cursor-pointer' : 'opacity-70'
                    } ${isSelected ? '!bg-[#DFF1F8]' : ''}`}
                  >
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand text-white font-medium">
                            Đang chọn
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td-cell font-mono text-xs">{t.tokenPreview}</td>
                    <td className="td-cell font-mono text-xs tabular-nums">{t.usedCount} / {t.maxUses || '∞'}</td>
                    <td className="td-cell text-xs">{formatDate(t.expiresAt)}</td>
                    <td className="td-cell">
                      <Badge label={statusLabel} cls={statusCls} />
                    </td>
                    <td className="td-cell text-right" onClick={(e) => e.stopPropagation()}>
                      {!t.isRevoked && (
                        <button onClick={() => handleRevokeToken(t.id)} className="btn-secondary text-red-600 px-2.5 py-1 text-xs">
                          Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Versions */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
          <Package className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold">Danh sách phiên bản Windows Agent (.NET Worker Service MSI)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Phiên bản</th>
                <th className="th-cell">Ghi chú phát hành</th>
                <th className="th-cell">Đường dẫn gói MSI</th>
                <th className="th-cell">Ngày phát hành</th>
                <th className="th-cell">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v, idx) => (
                <tr key={v.id}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold text-brand">v{v.version}</td>
                  <td className="td-cell text-xs">{v.releaseNotes || '—'}</td>
                  <td className="td-cell font-mono text-xs text-ink-muted">{v.downloadUrl || '—'}</td>
                  <td className="td-cell text-xs">{formatDate(v.releasedAt)}</td>
                  <td className="td-cell">
                    {v.isLatest ? (
                      <Badge label="Bản mới nhất" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    ) : (
                      <Badge label="Phiên bản cũ" cls="bg-slate-100 text-slate-600 border-slate-200" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={verOpen} onClose={() => setVerOpen(false)} title="Phát hành phiên bản Windows Agent mới" maxWidth="max-w-lg">
        <form onSubmit={handleCreateVersion} className="space-y-3.5">
          <div>
            <label className="label-field">Số phiên bản <span className="text-red-500">*</span></label>
            <input required value={verForm.version} onChange={(e) => setVerForm({ ...verForm, version: e.target.value })} className="input-field font-mono" placeholder="Nhập số phiên bản" />
          </div>
          <div>
            <label className="label-field">Đường dẫn tải bộ cài MSI</label>
            <input value={verForm.downloadUrl} onChange={(e) => setVerForm({ ...verForm, downloadUrl: e.target.value })} className="input-field font-mono" placeholder="Nhập đường dẫn tải bộ cài" />
          </div>
          <div>
            <label className="label-field">Ghi chú phát hành</label>
            <textarea rows={3} value={verForm.releaseNotes} onChange={(e) => setVerForm({ ...verForm, releaseNotes: e.target.value })} className="input-field" />
          </div>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={verForm.isLatest} onChange={(e) => setVerForm({ ...verForm, isLatest: e.target.checked })} className="w-4 h-4 accent-brand" />
              <span>Đặt làm bản mới nhất</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={verForm.isMandatory} onChange={(e) => setVerForm({ ...verForm, isMandatory: e.target.checked })} className="w-4 h-4 accent-brand" />
              <span>Bắt buộc cập nhật</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setVerOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Lưu phiên bản</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
