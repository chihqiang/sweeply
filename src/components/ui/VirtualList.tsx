import { memo, type ReactNode } from "react";
import { useVirtualList } from "@/hooks/useVirtualList";

/**
 * 虚拟列表组件 — 仅渲染可见区域内的列表项。
 *
 * 适用于固定行高的长列表场景（如文件列表、扫描结果列表），
 * 无论数据量多大，DOM 节点数始终保持在一个较小的范围。
 *
 * @example
 * <VirtualList itemCount={files.length} itemHeight={48} className="h-full">
 *   {(index) => <FileRow item={files[index]} />}
 * </VirtualList>
 */
export interface VirtualListProps {
  /** 总项数 */
  itemCount: number;
  /** 每项固定高度（px） */
  itemHeight: number;
  /** 渲染函数，接收索引返回对应行的 ReactNode */
  children: (index: number) => ReactNode;
  /** 可见区域外额外渲染的缓冲项数 */
  overscan?: number;
  /** 容器额外样式类名 */
  className?: string;
  /** 空列表时展示的内容 */
  emptyContent?: ReactNode;
}

export const VirtualList = memo(function VirtualList({
  itemCount,
  itemHeight,
  children,
  overscan = 5,
  className = "",
  emptyContent,
}: VirtualListProps) {
  const {
    containerRef,
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
    onScroll,
  } = useVirtualList(itemCount, itemHeight, overscan);

  if (itemCount === 0 && emptyContent) {
    return <div className={className}>{emptyContent}</div>;
  }

  const visibleItems: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(
      <div key={i} style={{ height: itemHeight }}>
        {children(i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className={`overflow-y-auto ${className}`}
    >
      <div style={{ paddingTop, paddingBottom }}>
        {visibleItems}
      </div>
    </div>
  );
});
