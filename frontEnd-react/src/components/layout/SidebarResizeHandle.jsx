import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
  sidebarMaxWidth,
} from './sidebarWidth';

const KEY_STEP = 16;
const RESIZING_CLASS = 'is-resizing-sidebar';

// Mép phải sidebar (máy tính): kéo để đổi độ rộng, bấm đúp để về mặc định, hoặc dùng phím
// ←/→ (Home/End) khi đang focus — mẫu "window splitter" của ARIA (đợt 15c).
// onChange chạy liên tục khi kéo; onCommit khi thả chuột / bấm phím (lúc đó mới lưu).
export function SidebarResizeHandle({ width, onChange, onCommit }) {
  const { t } = useTranslation();
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Số mới nhất đã gửi lên, để các phím bấm dồn trước khi kịp vẽ lại vẫn cộng dồn đúng.
  const latestWidth = useRef(width);
  useEffect(() => {
    latestWidth.current = width;
  }, [width]);

  // Độ rộng đang hiển thị: số đã lưu có thể lớn hơn trần của cửa sổ hiện tại, nên kéo/bấm phím
  // đi từ số đã cắt theo trần. Không đo DOM: giữa lúc sidebar đang chuyển động số đo bị lệch.
  const shownWidth = () => clampSidebarWidth(latestWidth.current);

  const commit = (next) => {
    latestWidth.current = next;
    onCommit(next);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setIsDragging(false);
    document.documentElement.classList.remove(RESIZING_CLASS);
    if (drag.moved) commit(drag.lastWidth);
  };

  // Gỡ class khóa con trỏ nếu sidebar bị gỡ giữa lúc kéo (đổi sang điện thoại, đăng xuất).
  useEffect(() => () => document.documentElement.classList.remove(RESIZING_CLASS), []);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startWidth = shownWidth();
    dragRef.current = { startX: event.clientX, startWidth, lastWidth: startWidth, moved: false };
    setIsDragging(true);
    document.documentElement.classList.add(RESIZING_CLASS);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampSidebarWidth(drag.startWidth + event.clientX - drag.startX);
    if (next === drag.lastWidth) return;
    drag.lastWidth = next;
    drag.moved = true;
    latestWidth.current = next;
    onChange(next);
  };

  const handleKeyDown = (event) => {
    const current = shownWidth();
    let next;
    if (event.key === 'ArrowLeft') next = current - KEY_STEP;
    else if (event.key === 'ArrowRight') next = current + KEY_STEP;
    else if (event.key === 'Home') next = SIDEBAR_MIN_WIDTH;
    else if (event.key === 'End') next = sidebarMaxWidth();
    else return;
    event.preventDefault();
    commit(clampSidebarWidth(next));
  };

  return (
    <div
      className={`sidebar-resize-handle${isDragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('nav.resize')}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={sidebarMaxWidth()}
      aria-valuenow={clampSidebarWidth(width)}
      title={t('nav.resizeHint')}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onDoubleClick={() => commit(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={handleKeyDown}
    />
  );
}
