export type PortProtocol = "tcp" | "udp";

/** 本机监听端口条目 */
export interface ListeningPort {
  port: number;
  /** 本地地址（含端口，如 127.0.0.1:8080 或 [::1]:8080） */
  address: string;
  protocol: PortProtocol;
  /** 占用进程名 */
  process: string;
  pid: number;
  /** socket 状态（tcp 一般为 listen，udp 为 unknown） */
  state: string;
}