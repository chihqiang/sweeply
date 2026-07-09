import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("updates after delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );
    expect(result.current).toBe("a");

    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("b");

    vi.useRealTimers();
  });

  it("resets timer on rapid changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    rerender({ value: "b", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: "c", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("c");

    vi.useRealTimers();
  });
});
