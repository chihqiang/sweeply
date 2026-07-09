import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClean } from "@/hooks/useClean";
import type { CleanScanSummary } from "@/types/clean";

const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

function mockScanSummary(): CleanScanSummary {
  return {
    categories: [
      {
        categoryId: "system",
        title: "系统垃圾",
        tips: "系统缓存、临时文件、日志和废纸篓",
        recommend: true,
        cautious: false,
        results: [],
        totalSize: 100,
        subcategories: [
          {
            subcategoryId: "sys-cache",
            title: "系统缓存",
            tips: "系统级缓存文件",
            recommend: true,
            cautious: false,
            totalSize: 100,
            results: [
              {
                id: "c1",
                title: "cache1",
                path: "/cache/1",
                displayPath: "/cache/1",
                size: 100,
                cleanMethod: "movetrash",
                selected: true,
              },
            ],
          },
        ],
      },
    ],
    totalSize: 100,
    selectedSize: 100,
    totalFileCount: 1,
    selectedFileCount: 1,
  };
}

describe("useClean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(vi.fn());
  });

  it("starts in Idle state", () => {
    const { result } = renderHook(() => useClean());
    expect(result.current.status).toBe("idle");
    expect(result.current.scanSummary).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches scan summary on startScan", async () => {
    const summary = mockScanSummary();
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => {
      await result.current.startScan();
    });

    expect(mockInvoke).toHaveBeenCalledWith("scan_clean_files");
    expect(result.current.scanSummary).toEqual(summary);
    expect(result.current.status).toBe("completed");
  });

  it("sets error on scan failure", async () => {
    mockInvoke.mockRejectedValue(new Error("scan failed"));

    const { result } = renderHook(() => useClean());

    await act(async () => {
      try { await result.current.startScan(); } catch { /* expected */ }
    });

    expect(result.current.error).toBe("scan failed");
    expect(result.current.status).toBe("error");
  });

  it("executes clean action", async () => {
    const cleanResult = { cleanedSize: 500, cleanedFileCount: 5, failedFileCount: 0 };
    mockInvoke.mockResolvedValue(cleanResult);

    const { result } = renderHook(() => useClean());

    await act(async () => {
      await result.current.executeCleanAction(["c1"], [100]);
    });

    expect(mockInvoke).toHaveBeenCalledWith("execute_clean", { selectedIds: ["c1"], sizes: [100] });
    expect(result.current.cleanResult).toEqual(cleanResult);
  });

  it("toggles item selection", async () => {
    const summary = mockScanSummary();
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });

    await act(() => { result.current.toggleItemSelection("c1"); });

    const item = result.current.scanSummary!.categories[0].subcategories[0].results[0];
    expect(item.selected).toBe(false);
  });

  it("toggles subcategory selection", async () => {
    const summary = mockScanSummary();
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });

    await act(() => { result.current.toggleSubcategorySelection("sys-cache"); });

    const item = result.current.scanSummary!.categories[0].subcategories[0].results[0];
    expect(item.selected).toBe(false);
  });

  it("toggles category selection (with subcategories)", async () => {
    const summary = mockScanSummary();
    // 先取消选中
    summary.categories[0].subcategories[0].results[0].selected = false;
    summary.selectedFileCount = 0;
    summary.selectedSize = 0;
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });

    await act(() => { result.current.toggleCategorySelection("system"); });

    const item = result.current.scanSummary!.categories[0].subcategories[0].results[0];
    expect(item.selected).toBe(true);
  });

  it("toggles category selection (with direct results)", async () => {
    const summary = mockScanSummary();
    // 改为直接结果（无子分类）
    summary.categories[0].results = [
      { id: "d1", title: "direct1", path: "/direct/1", displayPath: "/direct/1", size: 200, cleanMethod: "movetrash", selected: false },
    ];
    summary.categories[0].subcategories = [];
    summary.categories[0].totalSize = 200;
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });

    await act(() => { result.current.toggleCategorySelection("system"); });

    const item = result.current.scanSummary!.categories[0].results[0];
    expect(item.selected).toBe(true);
  });

  it("selects all recommended", async () => {
    const summary = mockScanSummary();
    // 取消选中
    summary.categories[0].subcategories[0].results[0].selected = false;
    summary.selectedFileCount = 0;
    summary.selectedSize = 0;
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });
    await act(() => { result.current.selectAllRecommended(); });

    const item = result.current.scanSummary!.categories[0].subcategories[0].results[0];
    expect(item.selected).toBe(true); // subcategory.recommend = true
  });

  it("deselects all", async () => {
    const summary = mockScanSummary();
    mockInvoke.mockResolvedValue(summary);

    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });
    await act(() => { result.current.deselectAll(); });

    const item = result.current.scanSummary!.categories[0].subcategories[0].results[0];
    expect(item.selected).toBe(false);
  });

  it("re-throws errors so callers can catch them", async () => {
    mockInvoke.mockRejectedValue(new Error("clean failed"));

    const { result } = renderHook(() => useClean());

    let caught = false;
    await act(async () => {
      try {
        await result.current.executeCleanAction(["c1"], [100]);
      } catch {
        caught = true;
      }
    });

    expect(caught).toBe(true);
    expect(result.current.error).toBe("clean failed");
  });

  it("resets state", async () => {
    mockInvoke.mockResolvedValue(mockScanSummary());
    const { result } = renderHook(() => useClean());

    await act(async () => { await result.current.startScan(); });
    await act(() => { result.current.reset(); });

    expect(result.current.scanSummary).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});
