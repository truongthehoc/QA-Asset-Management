import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Plus, Package } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, Modal, Badge } from '../../components/UiPrimitives';
import { formatDate } from '../../utils/format';

export const AgentManagementPage: React.FC = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [tokenForm, setTokenForm] = useState({ name: '', maxUses: '100', expiresDays: '30' });
  const [newRawToken, setNewRawToken] = useState('');
  const [verOpen, setVerOpen] = useState(false);
  const [verForm, setVerForm] = useState({ version: '', releaseNotes: '', downloadUrl: '', isLatest: true, isMandatory: false });
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [tRes, vRes] = await Promise.all([api.get('/agents/tokens'), api.get('/agents/versions')]);
    setTokens(tRes.data || []);
    setVersions(vRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await api.post('/agents/tokens', {
      name: tokenForm.name.trim(),
      maxUses: tokenForm.maxUses ? Number(tokenForm.maxUses) : undefined,
      expiresDays: Number(tokenForm.expiresDays) || 30,
    });
    setNewRawToken(res.data.rawToken);
    setTokenForm({ name: '', maxUses: '100', expiresDays: '30' });
    load();
  };

  const handleRevokeToken = async (id: string) => {
    if (!window.confirm('Xác nhận thu hồi Enrollment Token này?')) return;
    await api.patch(`/agents/tokens/${id}/revoke`);
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
              {tokens.map((t, idx) => (
                <tr key={t.id}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell text-xs font-medium">{t.name}</td>
                  <td className="td-cell font-mono text-xs">{t.tokenPreview}</td>
                  <td className="td-cell font-mono text-xs tabular-nums">{t.usedCount} / {t.maxUses || '∞'}</td>
                  <td className="td-cell text-xs">{formatDate(t.expiresAt)}</td>
                  <td className="td-cell">
                    <Badge
                      label={t.isRevoked ? 'Đã thu hồi' : 'Hiệu lực'}
                      cls={t.isRevoked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                    />
                  </td>
                  <td className="td-cell text-right">
                    {!t.isRevoked && (
                      <button onClick={() => handleRevokeToken(t.id)} className="btn-secondary text-red-600 px-2.5 py-1 text-xs">
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
