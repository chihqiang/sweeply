import { describe, it, expect } from "vitest";

const FILE_SIZE_BASE = 1024;
const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes <= 0) return "0 B";
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(FILE_SIZE_BASE)),
    FILE_SIZE_UNITS.length - 1,
  );
  const size = bytes / Math.pow(FILE_SIZE_BASE, unitIndex);
  return `${size.toFixed(decimals)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return "0 bps";
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  const unitIndex = Math.min(Math.floor(Math.log(bps) / Math.log(1000)), units.length - 1);
  return `${(bps / Math.pow(1000, unitIndex)).toFixed(2)} ${units[unitIndex]}`;
}

function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

describe("formatFileSize", () => {
  it("returns '0 B' for zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500.00 B");
  });
  it("formats KB", () => {
    expect(formatFileSize(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.00 MB");
  });
  it("formats GB", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
  it("respects decimals param", () => {
    expect(formatFileSize(1536, 0)).toBe("2 KB");
  });
});

describe("formatSpeed", () => {
  it("returns '0 bps' for zero", () => {
    expect(formatSpeed(0)).toBe("0 bps");
  });
  it("formats bps", () => {
    expect(formatSpeed(500)).toBe("500.00 bps");
  });
  it("formats Kbps", () => {
    expect(formatSpeed(1500)).toBe("1.50 Kbps");
  });
  it("formats Mbps", () => {
    expect(formatSpeed(5_000_000)).toBe("5.00 Mbps");
  });
  it("formats Gbps", () => {
    expect(formatSpeed(1_000_000_000)).toBe("1.00 Gbps");
  });
});

describe("cn", () => {
  it("joins truthy strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });
  it("filters falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
  it("returns empty string for all falsy", () => {
    expect(cn(false, undefined, null)).toBe("");
  });
});
