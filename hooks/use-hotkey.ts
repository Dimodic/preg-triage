"use client";

import { useEffect } from "react";

type HotkeyOptions = {
  metaOrCtrl?: boolean;
  shift?: boolean;
};

export const useHotkey = (
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = { metaOrCtrl: true },
) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const keyMatches = event.key.toLowerCase() === key.toLowerCase();
      const modifierOk = options.metaOrCtrl ? event.metaKey || event.ctrlKey : true;
      const shiftOk = options.shift ? event.shiftKey : !event.shiftKey || options.shift === undefined;

      if (keyMatches && modifierOk && shiftOk) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handler, key, options.metaOrCtrl, options.shift]);
};
