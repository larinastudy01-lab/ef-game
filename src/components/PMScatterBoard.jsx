import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPMScatterLayout } from "../utils/pmScatterLayout";

export default function PMScatterBoard({ items, seed, selectable = false, locked = false, selectedIds = [], onSelect }) {
  const boardRef = useRef(null);
  const [bounds, setBounds] = useState({ width: 960, height: 500 });
  useLayoutEffect(() => {
    const measure = () => {
      const { width, height } = boardRef.current.getBoundingClientRect();
      if (width && height) setBounds((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(boardRef.current);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const layout = useMemo(() => createPMScatterLayout({ ...bounds, count: items.length, seed }), [bounds, items.length, seed]);
  return (
    <div ref={boardRef} className="pm-practice-board" data-testid="pm-scatter-board" aria-label={selectable ? "選擇剛剛看過的圖片" : "記住這些圖片"}>
      {items.map((item, index) => {
        const position = layout[index];
        const style = { left: position.left, top: position.top, width: position.size, height: position.size };
        const content = <img src={item.image} alt={item.alt} width="162" height="162" draggable="false" />;
        return selectable ? (
          <button key={item.id} type="button" className="pm-practice-item" style={style}
            aria-label={item.alt} aria-pressed={selectedIds.includes(item.id)} data-item-id={item.id}
            disabled={locked} onClick={() => onSelect(item.id)}>{content}</button>
        ) : <div key={item.id} className="pm-practice-item" style={style} data-memory-id={item.id}>{content}</div>;
      })}
    </div>
  );
}
