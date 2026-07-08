/**
 * 格式化工具函数
 */
import { FILE_SIZE_BASE, FILE_SIZE_UNITS } from "@/constants/app";

/**
 * 格式化文件大小为可读字符串
 * @param bytes 字节数
 * @param decimals 保留小数位数
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
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

/**
 * 格式化速度（bps → 可读字符串）
 * @param bps 每秒比特数
 * @returns 格式化后的字符串，如 "12.5 Mbps"
 */
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

/**
 * 格式化时间戳为可读日期
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的字符串
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 格式化持续时间为可读字符串
 * @param ms 毫秒数
 * @returns 如 "1m 23s" 或 "45s"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * 格式化百分比值
 * @param value 0~1 的浮点数
 * @param decimals 保留小数位
 * @returns 如 "85.5%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
