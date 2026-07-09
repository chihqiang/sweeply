export interface KeychainFile {
  path: string;
  name: string;
  isLogin: boolean;
  isSystem: boolean;
  status: string;
}

export interface KeychainItem {
  id: string;
  title: string;
  kind: string;
  account: string;
  serverOrService: string;
  modifiedDate: string;
  rawData: string;
}

export interface KeychainListResult {
  keychains: KeychainFile[];
  totalItems: number;
}
