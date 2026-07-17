import { useState, useRef, useCallback, useEffect, type RefObject } from "react";

/**
 * 虚拟列表 Hook — 仅渲染可见区域内的列表项，大幅提升长列表性能。
 *
 * 原理：
 *   1. 监听容器滚动事件，计算当前可见的起始/结束索引
 *   2. 上下各扩展 overscan 个缓冲项，减少滚动时的空白闪烁
 *   3. 通过 paddingTop/paddingBottom 撑开总高度，保持滚动条正确
 *
 * @param itemCount  总项数
 * @param itemHeight 每项固定高度（px）
 * @param overscan   可见区域外额外渲染的项数（默认 5）
 */
export function useVirtualList(
  itemCount: number,
  itemHeight: number,
  overscan: number = 5,
): {
  containerRef: RefObject<HTMLDivElement | null>;
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
  onScroll: () => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => setViewportHeight(el.clientHeight);
    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const totalHeight = itemCount * itemHeight;

  // 计算可见范围
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.floor(scrollTop / itemHeight) + visibleCount + overscan,
  );

  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, totalHeight - (endIndex + 1) * itemHeight);

  return {
    containerRef,
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    totalHeight,
    onScroll,
  };
}
