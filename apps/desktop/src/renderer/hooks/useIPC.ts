import { useEffect, useRef } from "react";

export function useIPC(channel: string, handler: (...args: unknown[]) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped = (...args: unknown[]) => {
      handlerRef.current(...args);
    };

    window.browserAPI.on(channel, wrapped);
    return () => {
      window.browserAPI.off(channel, wrapped);
    };
  }, [channel]);
}

