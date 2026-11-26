import React, { useEffect, useState } from 'react';
import {
  Save,
  RotateCcw,
  Hash,
  Cpu,
  Bell,
  ShieldAlert,
  Sliders,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radar,
} from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, Badge } from '../../components/UiPrimitives';

interface GroupConfig {
  id: string;
  shortTitle: string;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}

const GROUP_LIST: GroupConfig[] = [
  {
    id: 'ASSET_CODE',
    shortTitle: 'Quy tắc mã tài sản',
    title: 'Quy tắc thiết lập & sinh mã tài sản',
    desc: 'Cấu hình cấu trúc sinh mã tự động và tùy chọn cho phép nhập mã thủ công.',
    icon: Hash,
  },
  {
    id: 'AGENT_SCHEDULE',
    shortTitle: 'Chu kỳ Windows Agent',
    title: 'Chu kỳ đồng bộ Windows Agent',
    desc: 'Agent tự động cập nhật lịch thu thập cấu hình thông qua API nội bộ.',
    icon: Cpu,
  },
  {
    id: 'DISCOVERY',
    shortTitle: 'Khám phá thiết bị',
    title: 'Cấu hình khám phá thiết bị & Quét LAN',
    desc: 'Bật hoặc tắt tính năng quét dải IP mạng LAN tùy theo mô hình triển khai (VPS/Cloud hay máy chủ nội bộ).',
    icon: Radar,
  },
  {
    id: 'ALERT',
    shortTitle: 'Ngưỡng cảnh báo',
    title: 'Ngưỡng cảnh báo vận hành',
    desc: 'Thiết lập thời gian phát hiện Agent ngoại tuyến và cảnh báo hết hạn bảo hành.',
    icon: Bell,
  },
  {
    id: 'SECURITY',
    shortTitle: 'Chính sách phần mềm',
    title: 'Chính sách kiểm soát phần mềm',
    desc: 'Danh sách từ khóa phần mềm cần kiểm tra hoặc không được phép cài đặt.',
    icon: ShieldAlert,
  },
];

interface FieldMeta {
  label: string;
  help: string;
  kind: 'text' | 'number' | 'boolean' | 'padding' | 'keywords' | 'pattern';
  unit?: string;
  min?: number;
  max?: number;
}

const FIELD_META: Record<string, FieldMeta> = {
  'asset_code.pattern': {
    label: 'Cấu trúc sinh mã tự động',
    help: 'Kết hợp tiền tố cố định với các biến {TYPE} (mã loại), {YEAR} (năm hiện tại) và {SEQ} (số thứ tự).',
    kind: 'pattern',
  },
  'asset_code.seq_padding': {
    label: 'Độ dài số thứ tự ({SEQ})',
    help: 'Số chữ số điền tự động cho phần số thứ tự tăng dần.',
    kind: 'padding',
  },
  'asset_code.allow_manual': {
    label: 'Cho phép nhập mã tài sản thủ công',
    help: 'Khi bật, nhân sự có quyền có thể nhập mã tài sản theo quy ước riêng của công ty.',
    kind: 'boolean',
  },
  'agent.heartbeat_interval_sec': {
    label: 'Chu kỳ gửi tín hiệu Heartbeat',
    help: 'Khoảng thời gian giữa các lần Agent báo trạng thái trực tuyến về máy chủ.',
    kind: 'number',
    unit: 'giây',
    min: 30,
  },
  'agent.hardware_interval_sec': {
    label: 'Chu kỳ kiểm tra phần cứng (CPU / RAM / Disk)',
    help: 'Định kỳ đối chiếu thông số phần cứng thực tế để phát hiện nâng cấp hoặc thay thế.',
    kind: 'number',
    unit: 'giây',
    min: 60,
  },
  'agent.software_interval_sec': {
    label: 'Chu kỳ kiểm tra danh sách phần mềm',
    help: 'Quét danh sách ứng dụng đã cài đặt từ Windows Registry 32-bit và 64-bit.',
    kind: 'number',
    unit: 'giây',
    min: 300,
  },
  'agent.license_interval_sec': {
    label: 'Chu kỳ kiểm tra trạng thái Windows License',
    help: 'Kiểm tra trạng thái kích hoạt hệ điều hành (chỉ thu thập 5 ký tự cuối, không lưu key đầy đủ).',
    kind: 'number',
    unit: 'giây',
    min: 600,
  },
  'agent.full_snapshot_interval_sec': {
    label: 'Chu kỳ gửi Snapshot toàn phần',
    help: 'Gửi toàn bộ hồ sơ phần cứng, hệ điều hành và phần mềm định kỳ về máy chủ.',
    kind: 'number',
    unit: 'giây',
    min: 600,
  },
  'agent.jitter_max_sec': {
    label: 'Độ trễ ngẫu nhiên chống nghẽn tải (Jitter)',
    help: 'Phân tán thời điểm gửi dữ liệu của các máy trạm để tránh đồng bộ cùng lúc.',
    kind: 'number',
    unit: 'giây',
    min: 0,
  },
  'agent.offline_threshold_min': {
    label: 'Ngưỡng thời gian đánh dấu Agent ngoại tuyến',
    help: 'Nếu quá khoảng thời gian này không nhận Heartbeat, thiết bị chuyển trạng thái ngoại tuyến và tạo cảnh báo.',
    kind: 'number',
    unit: 'phút',
    min: 5,
  },
  'warranty.expiring_days': {
    label: 'Thời hạn cảnh báo sắp hết bảo hành',
    help: 'Cảnh báo sớm trước khi tài sản hết hạn bảo hành nhà sản xuất.',
    kind: 'number',
    unit: 'ngày',
    min: 7,
  },
  'software.unauthorized_keywords': {
    label: 'Từ khóa phần mềm không được phép / cần kiểm tra',
    help: 'Bất kỳ ứng dụng nào có tên chứa các từ khóa này sẽ được gắn cờ cảnh báo tự động.',
    kind: 'keywords',
  },
  'discovery.lan_scan_enabled': {
    label: 'Bật tính năng quét dải IP mạng LAN (LAN Discovery)',
    help: 'Tắt khi triển khai trên VPS/Cloud (chỉ dùng Windows Agent và nhập thủ công). Bật khi triển khai máy chủ trong mạng nội bộ công ty.',
    kind: 'boolean',
  },
};

function formatDurationHuman(secondsRaw: string): string {
  const sec = Number(secondsRaw);
  if (!Number.isFinite(sec) || sec <= 0) return '0 giây';
  if (sec < 60) return `${sec} giây`;
  if (sec < 3600) {
    const mins = Math.round((sec / 60) * 10) / 10;
    return `${mins} phút`;
  }
  const hrs = Math.round((sec / 3600) * 10) / 10;
  return `${hrs} giờ`;
}

export const SettingsPage: React.FC = () => {
  const [original, setOriginal] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('ASSET_CODE');
  const [newKeyword, setNewKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    const res = await api.get('/admin/settings');
    const list: any[] = res.data || [];
    setOriginal(list);
    const map: Record<string, string> = {};
    for (const s of list) map[s.key] = s.value;
    setDraft(map);
  };

  useEffect(() => {
    load();
  }, []);

  const changedKeys = original.filter((s) => draft[s.key] !== s.value).map((s) => s.key);
  const isDirty = changedKeys.length > 0;

  const updateValue = (key: string, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const handleReset = () => {
    const map: Record<string, string> = {};
    for (const s of original) map[s.key] = s.value;
    setDraft(map);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setFeedback(null);
    try {
      const itemsToSave = changedKeys.map((key) => ({ key, value: draft[key] ?? '' }));
      await api.patch('/admin/settings', { items: itemsToSave });
      setFeedback({
        type: 'ok',
        text: `Đã lưu ${itemsToSave.length} tham số cấu hình hệ thống và ghi nhận Audit Log.`,
      });
      await load();
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.response?.data?.message || 'Không thể lưu cấu hình hệ thống.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Build live preview for asset code
  const patternVal = draft['asset_code.pattern'] || 'IT-{TYPE}-{YEAR}-{SEQ}';
  const paddingVal = Math.max(1, Math.min(8, Number(draft['asset_code.seq_padding']) || 4));
  const codePreview = patternVal
    .replace('{TYPE}', 'PC')
    .replace('{YEAR}', String(new Date().getFullYear()))
    .replace('{SEQ}', '1'.padStart(paddingVal, '0'));

  // Active group items
  const activeGroupMeta =
    GROUP_LIST.find((g) => g.id === selectedGroup) || {
      id: selectedGroup,
      shortTitle: selectedGroup,
      title: selectedGroup,
      desc: '',
      icon: Sliders,
    };
  const ActiveIcon = activeGroupMeta.icon;
  const groupItems = original.filter((s) => (s.group || 'GENERAL') === selectedGroup);

  // Keyword helpers for SECURITY group
  const keywordsList = (draft['software.unauthorized_keywords'] || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newKeyword.trim();
    if (!cleaned) return;
    if (!keywordsList.some((k) => k.toLowerCase() === cleaned.toLowerCase())) {
      updateValue('software.unauthorized_keywords', [...keywordsList, cleaned].join(','));
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    updateValue(
      'software.unauthorized_keywords',
      keywordsList.filter((k) => k !== kw).join(','),
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cấu hình hệ thống"
        subtitle="Thiết lập tham số vận hành chuẩn cho quy tắc mã tài sản, chu kỳ đồng bộ Agent, ngưỡng cảnh báo và chính sách phần mềm."
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <button type="button" onClick={handleReset} className="btn-secondary">
                <RotateCcw className="w-4 h-4" /> Hủy thay đổi
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={!isDirty || saving} className="btn-primary">
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : isDirty ? `Lưu cấu hình (${changedKeys.length})` : 'Lưu cấu hình'}
            </button>
          </div>
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
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Split Layout 2:8 matching RolesPage */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-start">
        {/* LEFT PANEL (2/10): Nhóm cấu hình */}
        <div className="lg:col-span-2 panel overflow-hidden">
          <div className="px-4 h-[76px] border-b border-line bg-slate-50/50 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-primary truncate">Nhóm cấu hình</h2>
              <Badge label={`${GROUP_LIST.length}`} cls="bg-brand-soft text-brand border-sky-200" />
            </div>
            <p className="text-xs text-ink-secondary mt-1 truncate">Chọn mục cần thiết lập</p>
          </div>

          <div className="px-4 py-2.5 bg-rail text-white border-b border-rail flex items-center justify-between text-xs font-medium">
            <span>Danh mục tham số</span>
          </div>

          <div className="divide-y divide-slate-100">
            {GROUP_LIST.map((grp, idx) => {
              const Icon = grp.icon;
              const isSelected = grp.id === selectedGroup;
              const itemsInGrp = original.filter((s) => s.group === grp.id);
              const dirtyCount = itemsInGrp.filter((s) => draft[s.key] !== s.value).length;
              const zebraBg = idx % 2 === 1 ? 'bg-[#F2F9FC]' : 'bg-white';

              return (
                <div
                  key={grp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedGroup(grp.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedGroup(grp.id);
                  }}
                  className={`relative px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#DFF1F8]' : `${zebraBg} hover:bg-[#E6F4F9]`
                  }`}
                >
                  {isSelected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-rail" />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-brand' : 'text-ink-muted'}`} />
                      <div className="min-w-0">
                        <div
                          className={`text-sm truncate ${
                            isSelected ? 'font-semibold text-brand' : 'font-medium text-ink-primary'
                          }`}
                        >
                          {grp.shortTitle}
                        </div>
                        <div className="text-[11px] text-ink-muted mt-0.5 tabular-nums">
                          {itemsInGrp.length} tham số
                        </div>
                      </div>
                    </div>
                    {dirtyCount > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0"
                        title={`${dirtyCount} thay đổi chưa lưu`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL (8/10): Chi tiết tham số nhóm đang chọn */}
        <div className="lg:col-span-8 panel overflow-hidden">
          {/* Matched 76px Header */}
          <div className="px-5 h-[76px] border-b border-line bg-slate-50/50 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <ActiveIcon className="w-4 h-4 text-brand shrink-0" />
                <h2 className="text-base font-semibold text-ink-primary truncate">{activeGroupMeta.title}</h2>
                {isDirty && <Badge label={`${changedKeys.length} chưa lưu`} cls="bg-amber-50 text-amber-800 border-amber-200" />}
              </div>
              <p className="text-xs text-ink-secondary mt-1 truncate" title={activeGroupMeta.desc}>
                {activeGroupMeta.desc}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>

          {/* Special Rich View for SECURITY Keywords vs Structured Table for other groups */}
          {selectedGroup === 'SECURITY' ? (
            <div>
              <div className="px-4 py-2.5 bg-rail text-white border-b border-rail text-xs font-medium">
                Danh sách từ khóa phần mềm không được phép / cần kiểm tra ({keywordsList.length})
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-ink-secondary">
                  Khi Windows Agent gửi danh sách ứng dụng cài đặt, mọi phần mềm có tên trùng khớp với các từ khóa dưới đây sẽ được hệ thống tự động đánh dấu và sinh cảnh báo an toàn thông tin.
                </p>

                <form onSubmit={handleAddKeyword} className="flex gap-2 max-w-md">
                  <input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Nhập từ khóa tên phần mềm"
                    className="input-field"
                  />
                  <button type="submit" className="btn-primary whitespace-nowrap">
                    <Plus className="w-4 h-4" /> Thêm từ khóa
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 pt-1">
                  {keywordsList.length === 0 ? (
                    <span className="text-xs text-ink-muted">Chưa thiết lập từ khóa nào.</span>
                  ) : (
                    keywordsList.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(kw)}
                          className="p-0.5 rounded-full hover:bg-red-100 text-red-500 hover:text-red-700"
                          aria-label={`Xóa ${kw}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Tham số cấu hình</th>
                    <th className="th-cell w-80">Giá trị thiết lập</th>
                  </tr>
                </thead>
                <tbody>
                  {groupItems.map((s, idx) => {
                    const meta = FIELD_META[s.key] || {
                      label: s.key,
                      help: s.description || '',
                      kind: 'text',
                    };
                    const val = draft[s.key] ?? '';
                    const isModified = val !== s.value;

                    return (
                      <tr key={s.key}>
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="td-cell">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-primary">{meta.label}</span>
                            {isModified && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Đã chỉnh sửa" />
                            )}
                          </div>
                          <div className="text-xs text-ink-secondary mt-0.5">{meta.help || s.description}</div>
                        </td>
                        <td className="td-cell">
                          {meta.kind === 'boolean' ? (
                            <label className="inline-flex items-center gap-3 cursor-pointer">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={val === 'true'}
                                onClick={() => updateValue(s.key, val === 'true' ? 'false' : 'true')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  val === 'true' ? 'bg-rail' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    val === 'true' ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className="text-xs font-medium text-ink-primary">
                                {val === 'true' ? 'Đang bật' : 'Đang tắt'}
                              </span>
                            </label>
                          ) : meta.kind === 'padding' ? (
                            <select
                              value={val}
                              onChange={(e) => updateValue(s.key, e.target.value)}
                              className="input-field max-w-[180px]"
                            >
                              <option value="3">3 chữ số</option>
                              <option value="4">4 chữ số</option>
                              <option value="5">5 chữ số</option>
                              <option value="6">6 chữ số</option>
                            </select>
                          ) : meta.kind === 'pattern' ? (
                            <div className="space-y-2">
                              <input
                                value={val}
                                onChange={(e) => updateValue(s.key, e.target.value)}
                                className="input-field font-mono text-xs"
                                placeholder="Nhập cấu trúc mã tài sản"
                              />
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {['{TYPE}', '{YEAR}', '{SEQ}'].map((tok) => (
                                  <button
                                    key={tok}
                                    type="button"
                                    onClick={() => {
                                      if (!val.includes(tok)) updateValue(s.key, `${val}${val.endsWith('-') ? '' : '-'}${tok}`);
                                    }}
                                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-line text-brand hover:bg-brand-soft"
                                  >
                                    + {tok}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : meta.kind === 'number' ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={meta.min ?? 0}
                                  value={val}
                                  onChange={(e) => updateValue(s.key, e.target.value)}
                                  className="input-field font-mono text-xs w-32 tabular-nums"
                                />
                                {meta.unit && (
                                  <span className="text-xs text-ink-secondary font-medium">{meta.unit}</span>
                                )}
                              </div>
                              {meta.unit === 'giây' && (
                                <div className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                                  <Clock className="w-3 h-3" />
                                  <span>Tương đương {formatDurationHuman(val)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <input
                              value={val}
                              onChange={(e) => updateValue(s.key, e.target.value)}
                              className="input-field text-xs"
                              placeholder="Nhập giá trị tham số"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedGroup === 'ASSET_CODE' && (
                <div className="px-5 py-3.5 bg-[#E6F4F9]/70 border-t border-line flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-ink-secondary">
                    Xem trước mã tài sản tự động sinh theo cấu hình hiện tại:
                  </div>
                  <span className="font-mono text-sm font-semibold text-brand bg-white px-3.5 py-1 rounded border border-sky-200">
                    {codePreview}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
