/**
 * 类名合并工具（基于 clsx）
 */
import { clsx, type ClassValue } from "clsx";

/**
 * 合并条件类名
 * @param inputs 类名输入
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
