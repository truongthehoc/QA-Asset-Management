import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { PageHeader, Badge } from '../components/UiPrimitives';
import { formatDateTime } from '../utils/format';

export const SoftwarePage: React.FC = () => {
  const [tab, setTab] = useState<'catalog' | 'windows' | 'check'>('catalog');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [windowsList, setWindowsList] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = async (q = '') => {
    const [cRes, wRes] = await Promise.all([
      api.get('/software/catalog', { params: q ? { search: q } : {} }),
      api.get('/software/windows'),
    ]);
    setCatalog(cRes.data);
    setWindowsList(wRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const needCheckList = [
    ...catalog.filter((s) => s.isUnauthorized).map((s) => ({ type: 'SOFTWARE', item: s })),
    ...windowsList.filter((w) => w.activationStatus !== 'ACTIVATED').map((w) => ({ type: 'WINDOWS', item: w })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phần mềm & Trạng thái Windows License"
        subtitle="Tổng hợp ứng dụng cài đặt từ Windows Registry (32/64-bit) và trạng thái kích hoạt Windows trên toàn hệ thống."
      />

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <button onClick={() => setTab('catalog')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'catalog' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Danh sách phần mềm ({catalog.length})
        </button>
        <button onClick={() => setTab('windows')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'windows' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Trạng thái Windows ({windowsList.length})
        </button>
        <button onClick={() => setTab('check')} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === 'check' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}>
          Cần kiểm tra chính sách & License ({needCheckList.length})
        </button>
      </div>

      {tab === 'catalog' && (
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(search);
            }}
            className="panel p-3 flex gap-2 max-w-lg"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên phần mềm hoặc nhà phát hành..." className="input-field pl-9" />
            </div>
            <button type="submit" className="btn-secondary">Tìm</button>
          </form>

          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Tên phần mềm</th>
                    <th className="th-cell">Nhà phát hành</th>
                    <th className="th-cell">Phiên bản phát hiện</th>
                    <th className="th-cell">Số máy cài</th>
                    <th className="th-cell">Thiết bị cài đặt</th>
                    <th className="th-cell">Chính sách</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((s, idx) => (
                    <tr key={s.displayName} className={s.isUnauthorized ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                      <td className="td-cell font-medium">{s.displayName}</td>
                      <td className="td-cell text-xs text-ink-secondary">{s.publisher}</td>
                      <td className="td-cell font-mono text-xs">{s.versions.join(', ') || '—'}</td>
                      <td className="td-cell font-mono font-semibold tabular-nums">{s.installCount}</td>
                      <td className="td-cell text-xs">
                        <div className="flex flex-wrap gap-1">
                          {s.devices.map((d: any, idx: number) =>
                            d.assetId ? (
                              <Link key={idx} to={`/assets/${d.assetId}`} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-brand">
                                {d.assetCode}
                              </Link>
                            ) : (
                              <span key={idx} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{d.hostname}</span>
                            ),
                          )}
                        </div>
                      </td>
                      <td className="td-cell">
                        {s.isUnauthorized ? (
                          <Badge label="Không được phép" cls="bg-red-50 text-red-700 border-red-200" />
                        ) : (
                          <Badge label="Cho phép" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'windows' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Tài sản / Hostname</th>
                  <th className="th-cell">Phòng ban</th>
                  <th className="th-cell">Hệ điều hành</th>
                  <th className="th-cell">Version / Build</th>
                  <th className="th-cell">Kênh / Partial Key</th>
                  <th className="th-cell">Trạng thái kích hoạt</th>
                  <th className="th-cell">Kiểm tra gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {windowsList.map((w, idx) => (
                  <tr key={w.agentId} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell">
                      {w.assetId ? (
                        <Link to={`/assets/${w.assetId}`} className="font-mono text-xs font-semibold text-brand hover:underline block">{w.assetCode}</Link>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Chưa duyệt</span>
                      )}
                      <span className="font-mono text-xs text-ink-muted">{w.hostname}</span>
                    </td>
                    <td className="td-cell text-xs">{w.department}</td>
                    <td className="td-cell text-xs font-medium">{w.productName} ({w.architecture})</td>
                    <td className="td-cell font-mono text-xs">{w.version} / {w.buildNumber}</td>
                    <td className="td-cell font-mono text-xs">{w.licenseChannel} • *****-{w.partialProductKey}</td>
                    <td className="td-cell">
                      {w.activationStatus === 'ACTIVATED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> {w.activationStatus}
                        </span>
                      )}
                    </td>
                    <td className="td-cell text-xs text-ink-secondary">{formatDateTime(w.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'check' && (
        <div className="space-y-3">
          {needCheckList.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-emerald-700">Không phát hiện phần mềm vi phạm chính sách hay Windows chưa kích hoạt.</div>
          ) : (
            needCheckList.map((entry, idx) => (
              <div key={idx} className="panel p-4 flex items-start justify-between gap-4 border-l-4 border-l-red-500">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    {entry.type === 'SOFTWARE' ? (
                      <>
                        <div className="text-sm font-semibold text-ink-primary">Phần mềm cần kiểm tra: {entry.item.displayName}</div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          Cài trên {entry.item.installCount} máy ({entry.item.devices.map((d: any) => `${d.assetCode} / ${d.hostname}`).join(', ')})
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-ink-primary">Windows chưa kích hoạt trên {entry.item.assetCode} ({entry.item.hostname})</div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          {entry.item.productName} {entry.item.version} • Trạng thái: {entry.item.activationStatus} • Phòng ban: {entry.item.department}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
