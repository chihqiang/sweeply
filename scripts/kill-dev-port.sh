#!/bin/sh
# 清理占用 Tauri 开发端口(默认 1420)的残留 vite 进程。
# 防止上次调试被强制结束后，孤儿 vite 进程占住端口导致下次 `tauri dev` 启动失败。
PORT="${TAURI_DEV_PORT:-1420}"

pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)"

[ -z "$pids" ] && exit 0

for pid in $pids; do
  kill "$pid" 2>/dev/null
done

echo "[dev] 已清理占用端口 $PORT 的残留进程: $(echo "$pids" | tr '\n' ' ')"