/**
 * NProgress 进度条配置
 */
import nprogress from "nprogress";
import { NPROGRESS_CONFIG } from "@/constants/app";

/** 配置 NProgress */
nprogress.configure(NPROGRESS_CONFIG);

/** 开始进度条 */
export function startProgress(): void {
  nprogress.start();
}

/** 结束进度条 */
export function doneProgress(): void {
  nprogress.done();
}

/** 设置进度条到指定值 */
export function setProgress(value: number): void {
  nprogress.set(value);
}

export default nprogress;
