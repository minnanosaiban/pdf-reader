import { useEffect, useRef, useState } from "react";

interface Props {
  current: number;
  numPages: number;
  onGo: (page: number) => void;
  onClose: () => void;
}

/** 第20節：Ctrl/Cmd + G のページ指定。8 を指定すると Page 8 | Page 9。 */
export function PageJumpInput({ current, numPages, onGo, onClose }: Props) {
  const [value, setValue] = useState(String(current));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = () => {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) onGo(Math.min(Math.max(n, 1), numPages));
    onClose();
  };

  return (
    <div className="jump-dialog" role="dialog" aria-label="ページ指定" data-wheel-exclude>
      <label>
        ページ
        <input
          ref={ref}
          type="number"
          min={1}
          max={numPages}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <span> / {numPages}</span>
      </label>
      <button type="button" className="text-btn" onClick={submit}>
        移動
      </button>
    </div>
  );
}
