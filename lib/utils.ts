import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TranscriptEntry, TranscriptRole, UrgencyLevel } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatClock = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const stripTimePrefix = (line: string) => line.replace(/^\[[^\]]+\]\s*/, "").trim();

export const parseTranscriptTimeline = (transcript: string): TranscriptEntry[] => {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: TranscriptEntry[] = lines.map((line, index): TranscriptEntry => {
    const timeMatch = line.match(/^\[(\d{2}:\d{2})\]\s*/);
    const roleMatch = stripTimePrefix(line).match(/^(Operator|Caller|Диспетчер|Звонящая|Пациентка)\s*:\s*(.+)$/i);
    const time = timeMatch?.[1] ?? `${String(Math.floor(index / 2)).padStart(2, "0")}:${String((index % 2) * 15).padStart(2, "0")}`;

    if (roleMatch) {
      const normalizedRole = roleMatch[1].toLowerCase();
      const role: TranscriptRole = normalizedRole === "operator" || normalizedRole === "диспетчер"
        ? "Operator"
        : "Caller";
      return {
        id: `line-${index}`,
        role,
        text: roleMatch[2],
        time,
      };
    }

    const role: TranscriptRole = index % 2 === 0 ? "Caller" : "Operator";

    return {
      id: `line-${index}`,
      role,
      text: stripTimePrefix(line),
      time,
    };
  });

  return entries;
};

export const urgencyColor: Record<UrgencyLevel, string> = {
  0: "#94A3B8",
  1: "#F59E0B",
  2: "#F97316",
  3: "#EF4444",
};

export const urgencyLabel: Record<UrgencyLevel, string> = {
  0: "Наблюдение",
  1: "Контроль",
  2: "Срочно",
  3: "Выезд сейчас",
};

export const safeJsonParse = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const downloadJson = (filename: string, data: unknown) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const randomCallId = () => `ВЫЗОВ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
