import { useLayoutEffect, useRef, useState } from "react";
import { placementLabel, scaleLabel } from "../lib/layout";
import type { PagePlacement, ScalePercent } from "../lib/types";

interface Props {
  anchor: DOMRect;
  scalePercent: ScalePercent;
  placement: PagePlacement;
  onScale: (s: ScalePercent) => void;
  onPlacement: (p: PagePlacement) => void;
  onClose: () => void;
}

const SCALES: ScalePercent[] = [100, 90, 80];
const PLACEMENTS: PagePlacement[] = ["center", "top-left", "top-center"];

function RadioGroup<T extends string | number>({
  label,
  items,
  value,
  text,
  onChange,
}: {
  label: string;
  items: T[];
  value: T;
  text: (v: T) => string;
  onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (dir: number) => {
    const i = items.indexOf(value);
    const n = (i + dir + items.length) % items.length;
    onChange(items[n]);
    refs.current[n]?.focus();
  };
  return (
    <div className="pop-group">
      <div className="pop-label" id={`pop-${label}`}>
        {label}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`pop-${label}`}
        className="pop-radios"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {items.map((it, i) => (
          <button
            key={String(it)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={it === value}
            tabIndex={it === value ? 0 : -1}
            className="pop-radio"
            onClick={() => onChange(it)}
          >
            {text(it)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 第16A節：表示ボタンのポップオーバー。即時反映、PDFに重なってもよい一時表示。 */
export function ViewDisplayPopover(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(props.anchor.top);

  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    // 画面下端からはみ出す場合は上方向へずらす
    setTop(Math.max(8, Math.min(props.anchor.top, window.innerHeight - h - 8)));
  }, [props.anchor]);

  useLayoutEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="radio"][tabindex="0"]')?.focus();
  }, []);

  return (
    <div
      ref={ref}
      className="view-popover"
      role="dialog"
      aria-label="表示"
      data-wheel-exclude
      data-popover
      style={{ left: props.anchor.right + 6, top }}
    >
      <RadioGroup
        label="表示倍率"
        items={SCALES}
        value={props.scalePercent}
        text={scaleLabel}
        onChange={props.onScale}
      />
      <RadioGroup
        label="配置"
        items={PLACEMENTS}
        value={props.placement}
        text={placementLabel}
        onChange={props.onPlacement}
      />
    </div>
  );
}
