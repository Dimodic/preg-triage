"use client";

import { useCallback, useEffect, useState } from "react";

export const useCallTimer = (isRunning: boolean) => {
  const [seconds, setSeconds] = useState(0);
  const reset = useCallback(() => setSeconds(0), []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  return {
    seconds,
    reset,
  };
};
