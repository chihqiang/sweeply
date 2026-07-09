export const APP_NAME = "Sweeply";

export const FILE_SIZE_BASE = 1024;

export const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export const NPROGRESS_CONFIG = {
  minimum: 0.1,
  easing: "ease",
  speed: 400,
  showSpinner: false,
  trickle: true,
  trickleSpeed: 200,
} as const;

export const WINDOW_DEFAULTS = {
  minWidth: 720,
  minHeight: 480,
} as const;
