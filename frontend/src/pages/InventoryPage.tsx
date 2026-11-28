import React, { useEffect, useState } from 'react';
import { Plus, QrCode, CheckCircle2, ClipboardList } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { PageHeader, Modal, InventoryStatusBadge, Badge } from '../components/UiPrimitives';
import { DateInputVN } from '../components/FormInputs';
import { formatDate } from '../utils/format';

export const InventoryPage: React.FC = () => {
  const { can } = useAuth();
  const { confirm, prompt } = useDialog();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [meta, setMeta] = useState<any>({ departments: [], assetTypes: [] });
  const [createOpen, setCreateOpen] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [scanMsg, setScanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newForm, setNewForm] = useState({ name: '', departmentId: '', dueDate: '', notes: '' });

  const loadSessions = async (selectId?: string) => {
    const [sRes, mRes] = await Promise.all([api.get('/inventory/sessions'), api.get('/admin/meta')]);
    setSessions(sRes.data);
    setMeta(mRes.data);
    const idToLoad = selectId || activeSession?.id || sRes.data[0]?.id;
    if (idToLoad) {
      const det = await api.get(`/inventory/sessions/${idToLoad}`);
      setActiveSession(det.data);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (!scanMsg) return;
    const t = window.setTimeout(() => setScanMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [scanMsg]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post('/inventory/sessions', newForm);
    setCreateOpen(false);
    setNewForm({ name: '', departmentId: '', dueDate: '', notes: '' });
    loadSessions(res.data.id);
  };

  const handleQrScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !qrInput.trim()) return;
    setScanMsg(null);
    try {
      const res = await api.post(`/inventory/sessions/${activeSession.id}/scan`, { code: qrInput.trim() });
      setScanMsg({ type: 'ok', text: `Đã xác nhận kiểm kê tài sản ${res.data.asset?.assetCode} (${res.data.asset?.name}).` });
      setQrInput('');
      loadSessions(activeSession.id);
    } catch (err: any) {
      setScanMsg({ type: 'err', text: err.response?.data?.message || 'Không tìm thấy mã tài sản.' });
    }
  };

  const handleItemStatusChange = async (item: any, status: string) => {
    let notes = item.discrepancyNotes || '';
    if (status !== 'CHECKED' && status !== 'NOT_CHECKED') {
      const promptRes = await prompt({
        title: 'Ghi nhận sai lệch kiểm kê',
        message: `Nhập ghi chú sai lệch / tình trạng thực tế cho tài sản ${item.asset?.assetCode || ''}:`,
        defaultValue: notes,
        inputLabel: 'Ghi chú thực tế',
        confirmLabel: 'Lưu trạng thái',
        tone: 'warning',
        multiline: true,
      });
      if (promptRes === null) return;
      notes = promptRes;
    }
    await api.patch(`/inventory/items/${item.id}`, { status, discrepancyNotes: notes });
    loadSessions(activeSession.id);
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    const ok = await confirm({
      title: 'Chốt hoàn tất đợt kiểm kê',
      message: `Xác nhận chốt hoàn tất đợt kiểm kê "${activeSession.name}"? Sau khi chốt sẽ không thể chỉnh sửa kết quả.`,
      confirmLabel: 'Chốt hoàn tất',
      tone: 'primary',
    });
    if (!ok) return;
    await api.patch(`/inventory/sessions/${activeSession.id}/complete`);
    loadSessions(activeSession.id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kiểm kê tài sản"
        subtitle="Tạo đợt kiểm kê toàn công ty hoặc theo phòng ban, quét mã QR đối chiếu thực tế và ghi nhận sai lệch vị trí, người dùng, cấu hình."
        actions={
          can('inventory.manage') && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Tạo đợt kiểm kê
            </button>
          )
        }
      />

      <div className="grid lg:grid-cols-12 gap-4">
        {/* Session List */}
        <div className="lg:col-span-4 space-y-2.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSessions(s.id)}
              className={`w-full text-left panel p-4 transition-colors ${
                activeSession?.id === s.id ? 'border-brand ring-1 ring-brand/20 bg-blue-50/30' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-brand">{s.sessionCode}</span>
                <Badge
                  label={s.status === 'COMPLETED' ? 'Hoàn tất' : 'Đang kiểm kê'}
                  cls={s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                />
              </div>
              <div className="text-sm font-medium text-ink-primary mt-1">{s.name}</div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums">
                <div className="bg-emerald-50 text-emerald-700 rounded py-1">Đã kiểm: <strong>{s.stats?.checked || 0}</strong></div>
                <div className="bg-slate-100 text-slate-700 rounded py-1">Chưa kiểm: <strong>{s.stats?.notChecked || 0}</strong></div>
                <div className="bg-orange-50 text-orange-700 rounded py-1">Sai lệch: <strong>{s.stats?.discrepancy || 0}</strong></div>
              </div>
            </button>
          ))}
        </div>

        {/* Active Session Detail */}
        <div className="lg:col-span-8 space-y-4">
          {activeSession ? (
            <>
              <div className="panel p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-brand font-semibold">{activeSession.sessionCode}</div>
                    <h2 className="text-base font-semibold text-ink-primary">{activeSession.name}</h2>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Hạn hoàn thành: {formatDate(activeSession.dueDate)} • {activeSession.notes || 'Không có ghi chú'}
                    </p>
                  </div>
                  {activeSession.status !== 'COMPLETED' && can('inventory.manage') && (
                    <button onClick={handleCompleteSession} className="btn-secondary text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Chốt hoàn tất đợt
                    </button>
                  )}
                </div>

                {/* Quick QR / Code Scanner Bar */}
                {activeSession.status !== 'COMPLETED' && can('inventory.manage') && (
                  <form onSubmit={handleQrScan} className="flex gap-2 pt-2 border-t border-line">
                    <div className="relative flex-1">
                      <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={qrInput}
                        onChange={(e) => setQrInput(e.target.value)}
                        placeholder="Quét mã QR hoặc nhập mã tài sản rồi nhấn Enter..."
                        className="input-field pl-9 font-mono"
                      />
                    </div>
                    <button type="submit" className="btn-primary">
                      Xác nhận nhanh
                    </button>
                  </form>
                )}

                {scanMsg && (
                  <div className={`p-2.5 rounded text-xs border ${scanMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {scanMsg.text}
                  </div>
                )}
              </div>

              <div className="panel overflow-hidden">
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-line">
                  {(activeSession.items || []).map((it: any) => (
                    <div key={it.id} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand">{it.asset?.assetCode}</span>
                        <InventoryStatusBadge status={it.status} />
                      </div>
                      <div className="text-xs font-medium text-ink-primary">{it.asset?.name}</div>
                      <div className="text-[11px] text-ink-muted">
                        {it.asset?.usingDepartment?.name || 'Kho'} • {it.asset?.assignedUserName || '—'}
                      </div>
                      {(it.discrepancyNotes || it.actualCondition || it.checkedBy) && (
                        <div className="text-[11px] text-ink-secondary bg-slate-50 rounded p-2">
                          {it.discrepancyNotes || it.actualCondition || ''}
                          {it.checkedBy && (
                            <div className="text-ink-muted mt-0.5">
                              Bởi {it.checkedBy}
                              {it.checkedAt ? ` • ${formatDate(it.checkedAt)}` : ''}
                            </div>
                          )}
                        </div>
                      )}
                      {activeSession.status !== 'COMPLETED' && can('inventory.manage') && (
                        <select
                          value={it.status}
                          onChange={(e) => handleItemStatusChange(it, e.target.value)}
                          className="input-field py-1.5 text-xs w-full"
                        >
                          <option value="NOT_CHECKED">Chưa kiểm kê</option>
                          <option value="CHECKED">Đã kiểm kê (Khớp)</option>
                          <option value="MISSING">Không tìm thấy</option>
                          <option value="WRONG_LOCATION">Sai vị trí</option>
                          <option value="WRONG_USER">Sai người sử dụng</option>
                          <option value="WRONG_CONFIG">Sai cấu hình</option>
                          <option value="DAMAGED">Hư hỏng</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="th-cell w-12 text-center">STT</th>
                        <th className="th-cell">Mã tài sản</th>
                        <th className="th-cell">Thiết bị & Đơn vị sổ sách</th>
                        <th className="th-cell">Trạng thái kiểm kê</th>
                        <th className="th-cell">Ghi chú thực tế</th>
                        <th className="th-cell text-right">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeSession.items || []).map((it: any, idx: number) => (
                        <tr key={it.id} className="hover:bg-slate-50/70">
                          <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                          <td className="td-cell font-mono text-xs font-semibold">{it.asset?.assetCode}</td>
                          <td className="td-cell text-xs">
                            <div className="font-medium text-ink-primary">{it.asset?.name}</div>
                            <div className="text-ink-muted">
                              {it.asset?.usingDepartment?.name || 'Kho'} • {it.asset?.assignedUserName || '—'}
                            </div>
                          </td>
                          <td className="td-cell">
                            <InventoryStatusBadge status={it.status} />
                          </td>
                          <td className="td-cell text-xs text-ink-secondary">
                            {it.discrepancyNotes || it.actualCondition || '—'}
                            {it.checkedBy && (
                              <div className="text-[11px] text-ink-muted">
                                Bởi {it.checkedBy}
                                {it.checkedAt ? ` • ${formatDate(it.checkedAt)}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="td-cell text-right">
                            {activeSession.status !== 'COMPLETED' && can('inventory.manage') && (
                              <select
                                value={it.status}
                                onChange={(e) => handleItemStatusChange(it, e.target.value)}
                                className="input-field py-1 text-xs w-36"
                              >
                                <option value="NOT_CHECKED">Chưa kiểm kê</option>
                                <option value="CHECKED">Đã kiểm kê (Khớp)</option>
                                <option value="MISSING">Không tìm thấy</option>
                                <option value="WRONG_LOCATION">Sai vị trí</option>
                                <option value="WRONG_USER">Sai người sử dụng</option>
                                <option value="WRONG_CONFIG">Sai cấu hình</option>
                                <option value="DAMAGED">Hư hỏng</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="panel p-10 text-center text-sm text-ink-muted">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Chọn một đợt kiểm kê để xem chi tiết.
            </div>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo đợt kiểm kê tài sản mới" maxWidth="max-w-lg">
        <form onSubmit={handleCreateSession} className="space-y-3.5">
          <div>
            <label className="label-field">Tên đợt kiểm kê <span className="text-red-500">*</span></label>
            <input required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="input-field" placeholder="Nhập tên đợt kiểm kê" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Phạm vi phòng ban</label>
              <select value={newForm.departmentId} onChange={(e) => setNewForm({ ...newForm, departmentId: e.target.value })} className="input-field">
                <option value="">Toàn bộ phòng ban</option>
                {meta.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Hạn hoàn thành</label>
              <DateInputVN
                value={newForm.dueDate}
                onChange={(iso) => setNewForm({ ...newForm, dueDate: iso })}
              />
            </div>
          </div>
          <div>
            <label className="label-field">Ghi chú</label>
            <textarea rows={2} value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary">Khởi tạo đợt kiểm kê</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
