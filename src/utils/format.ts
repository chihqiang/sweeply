import { FILE_SIZE_BASE, FILE_SIZE_UNITS } from "@/constants/app";

export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes <= 0) return "0 B";

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(FILE_SIZE_BASE)),
    FILE_SIZE_UNITS.length - 1,
  );
  const size = bytes / Math.pow(FILE_SIZE_BASE, unitIndex);
  const unit = FILE_SIZE_UNITS[unitIndex];

  return `${size.toFixed(decimals)} ${unit}`;
}

export function formatSpeed(bps: number): string {
  if (bps <= 0) return "0 bps";

  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bps) / Math.log(1000)),
    units.length - 1,
  );
  const speed = bps / Math.pow(1000, unitIndex);

  return `${speed.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
