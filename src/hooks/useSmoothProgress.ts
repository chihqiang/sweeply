import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 平滑进度 Hook
 *
 * 接收后端发来的原始进度值（可能跳跃式更新），
 * 返回一个平滑插值后的显示进度。
 *
 * 特性：
 * 1. 收到新目标值后，用 requestAnimationFrame 平滑过渡到该值
 * 2. 如果长时间没有新进度事件，自动以缓慢速度向前蠕动（trickle），
 *    但永远不会超过 `target + trickleCeiling`
 * 3. 目标值到达 1.0 时立即完成
 */
export function useSmoothProgress(
  /** 原始目标进度 0~1，null 表示未激活 */
  target: number | null,
  options?: {
    /** 每帧最大增量（默认 0.008 = 约 2 秒从 0 到 1） */
    speed?: number;
    /** 无新事件时，trickle 前进的上限（默认距离 target 的 0.12） */
    trickleCeiling?: number;
    /** trickle 触发的静默时间（ms，默认 800） */
    trickleDelay?: number;
    /** trickle 每帧增量（默认 0.0008） */
    trickleSpeed?: number;
  },
): number {
  const {
    speed = 0.012,
    trickleCeiling = 0.12,
    trickleDelay = 800,
    trickleSpeed = 0.0006,
  } = options ?? {};

  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const targetRef = useRef<number>(0);
  const displayRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // 更新目标值
  useEffect(() => {
    if (target == null) {
      targetRef.current = 0;
      displayRef.current = 0;
      setDisplay(0);
      return;
    }
    targetRef.current = target;
    lastUpdateRef.current = performance.now();

    // 目标为 1.0（完成）时直接跳到 1
    if (target >= 1) {
      displayRef.current = 1;
      setDisplay(1);
    }
  }, [target]);

  // requestAnimationFrame 循环
  useEffect(() => {
    if (target == null) return;

    const tick = () => {
      const targetVal = targetRef.current;
      const currentVal = displayRef.current;
      const now = performance.now();
      const elapsed = now - lastUpdateRef.current;

      let next = currentVal;

      if (targetVal >= 1 && currentVal >= 0.99) {
        // 完成
        next = 1;
      } else if (currentVal < targetVal) {
        // 还没到目标值，平滑追赶
        const diff = targetVal - currentVal;
        next = currentVal + Math.max(diff * 0.15, speed * 0.3);
        if (next > targetVal) next = targetVal;
      } else if (elapsed > trickleDelay) {
        // 超过 trickleDelay 没有新事件，开始缓慢蠕动
        const ceiling = Math.min(targetVal + trickleCeiling, 0.95);
        if (currentVal < ceiling) {
          next = currentVal + trickleSpeed;
          if (next > ceiling) next = ceiling;
        }
      }

      // 只有变化足够大才 setState，避免过多渲染
      if (Math.abs(next - currentVal) > 0.0005) {
        displayRef.current = next;
        setDisplay(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, speed, trickleCeiling, trickleDelay, trickleSpeed]);

  // 重置
  const reset = useCallback(() => {
    displayRef.current = 0;
    targetRef.current = 0;
    setDisplay(0);
  }, []);

  useEffect(() => {
    if (target == null) reset();
  }, [target, reset]);

  return display;
}
