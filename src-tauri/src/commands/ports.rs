use serde::{Deserialize, Serialize};
use std::io;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub port: u16,
    /// 本地地址（含端口）
    pub address: String,
    pub protocol: String,
    /// 占用进程名
    pub process: String,
    pub pid: u32,
    pub state: String,
}

/// 列出本机所有监听中的端口（TCP LISTEN + UDP 绑定）。
/// 基于 listeners 库的底层系统 API 实现，不调用 lsof/netstat 等命令。
/// 同步命令由 Tauri 在独立线程池执行，不会阻塞主线程。
#[tauri::command]
pub fn list_listening_ports() -> Result<Vec<ListeningPort>, String> {
    let all = listeners::get_all().map_err(|e| format!("获取端口列表失败: {}", e))?;

    let mut ports: Vec<ListeningPort> = all
        .into_iter()
        .filter(|l| {
            // 只保留监听中的端口：TCP 需处于 Listen，UDP 为绑定态（状态为 Unknown/适用 UDP）
            if l.socket.port() == 0 {
                return false;
            }
            match l.protocol {
                listeners::Protocol::UDP => true,
                listeners::Protocol::TCP => l.state == listeners::SocketState::Listen,
            }
        })
        .map(|l| ListeningPort {
            port: l.socket.port(),
            address: l.socket.to_string(),
            protocol: match l.protocol {
                listeners::Protocol::TCP => "tcp".to_string(),
                listeners::Protocol::UDP => "udp".to_string(),
            },
            process: l.process.name,
            pid: l.process.pid,
            state: format!("{}", l.state).to_lowercase(),
        })
        .collect();

    ports.sort_by(|a, b| a.port.cmp(&b.port).then_with(|| a.protocol.cmp(&b.protocol)));
    Ok(ports)
}

/// 结束指定进程（发送 SIGTERM 优雅终止）。
/// 直接调用 libc::kill，不调用 kill 等系统命令。
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    let result = unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM) };
    if result != 0 {
        let err = io::Error::last_os_error();
        return Err(format!("结束进程失败 (PID {}): {}", pid, err));
    }
    Ok(())
}