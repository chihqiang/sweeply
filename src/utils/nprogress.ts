import nprogress from "nprogress";
import { NPROGRESS_CONFIG } from "@/constants/app";

nprogress.configure(NPROGRESS_CONFIG);

export function startProgress(): void {
  nprogress.start();
}

export function doneProgress(): void {
  nprogress.done();
}

export default nprogress;
