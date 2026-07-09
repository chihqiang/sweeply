import { useState, useCallback, useRef, useEffect } from "react";
import { TaskStatus } from "@/types/common";
import { toError } from "@/utils/error";

export interface AsyncTaskState<T> {
  status: TaskStatus;
  error: string | null;
  result: T | null;
}

export function useAsyncTask<T, A extends unknown[] = []>(
  task: (...args: A) => Promise<T>,
) {
  const [state, setState] = useState<AsyncTaskState<T>>({
    status: TaskStatus.Idle,
    error: null,
    result: null,
  });
  const taskRef = useRef(task);
  const mountedRef = useRef(true);
  const genRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    taskRef.current = task;
    return () => { mountedRef.current = false; };
  }, [task]);

  const execute = useCallback(
    async (...args: A): Promise<T> => {
      const gen = ++genRef.current;
      setState({ status: TaskStatus.Processing, error: null, result: null });
      try {
        const result = await taskRef.current(...args);
        if (mountedRef.current && gen === genRef.current) {
          setState({ status: TaskStatus.Completed, error: null, result });
        }
        return result;
      } catch (err) {
        if (mountedRef.current && gen === genRef.current) {
          setState({ status: TaskStatus.Error, error: toError(err), result: null });
        }
        throw err;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    genRef.current++;
    if (mountedRef.current) setState({ status: TaskStatus.Idle, error: null, result: null });
  }, []);

  return { ...state, execute, reset };
}
