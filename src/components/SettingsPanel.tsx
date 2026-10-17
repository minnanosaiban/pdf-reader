import type { AppSettings, PenTool } from "../lib/types";

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onOpenFile: () => void;
  onClose: () => void;
  persistenceAvailable: boolean;
}

const PEN_LABELS: Record<PenTool, string> = {
  yellow: "黄色マーカー",
  pink: "ピンクマーカー",
  red: "赤ライン",
  blue: "青ライン",
};

/** 第43節：設定パネル。表示するときだけ右側に出る。 */
export function SettingsPanel({ settings, onChange, onOpenFile, onClose, persistenceAvailable }: Props) {
  return (
    <aside className="settings-panel" aria-label="設定" role="dialog" data-wheel-exclude>
      <div className="settings-head">
        <h2>設定</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          閉じる
        </button>
      </div>

      <h3>筆記具の色</h3>
      {(Object.keys(PEN_LABELS) as PenTool[]).map((k) => (
        <label key={k} className="settings-row">
          <span>{PEN_LABELS[k]}</span>
          <input
            type="color"
            value={settings.penColors[k]}
            onChange={(e) =>
              onChange({ ...settings, penColors: { ...settings.penColors, [k]: e.target.value } })
            }
          />
        </label>
      ))}

      <h3>動き</h3>
      <label className="settings-row">
        <span>モーション軽減（ページ移動の動きをなくす）</span>
        <input
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={(e) => onChange({ ...settings, reduceMotion: e.target.checked })}
        />
      </label>

      <h3>ファイル</h3>
      <button type="button" className="text-btn wide" onClick={onOpenFile}>
        別のPDFを開く
      </button>
      {!persistenceAvailable && (
        <p className="settings-note">この環境では保存と復元は利用できません。</p>
      )}
    </aside>
  );
}
