export interface VolumeInfo {
  mountPoint: string;
  totalSpace: number;
  availableSpace: number;
  fileSystem: string;
}

export interface BatteryInfo {
  cycleCount: number | null;
  condition: string;
  chargePercent: number;
  isCharging: boolean;
}

export interface SystemInfo {
  modelName: string;
  modelIdentifier: string;
  chip: string;
  physicalCores: number;
  logicalCores: number;
  osVersion: string;
  osBuild: string;
  kernelVersion: string;
  hostName: string;
  uptimeSeconds: number;
  cpuUsage: number;
  totalMemory: number;
  usedMemory: number;
  volumes: VolumeInfo[];
  battery: BatteryInfo | null;
}
