import { useRef } from 'react';

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Nhóm chọn một (radio): một điểm dừng Tab, mũi tên đổi danh mục và chuyển focus theo. */
export function useRadioArrows() {
  const groupRef = useRef(null);
  const onKeyDown = (event) => {
    const step = ARROW_STEP[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
    const radios = [...(groupRef.current?.querySelectorAll('[role="radio"]') || [])];
    const index = radios.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = radios[(index + step + radios.length) % radios.length];
    next.focus();
    next.click();
  };
  return { groupRef, onKeyDown };
}
