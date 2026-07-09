export interface LoginItem {
  name: string;
  path: string;
  hidden: boolean;
  iconPath: string;
}

export interface BackgroundItem {
  label: string;
  pid: number | null;
  status: string;
  iconPath: string;
}
