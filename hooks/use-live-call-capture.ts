"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveRole = "Operator" | "Caller";
type LiveSource = "mic" | "system";

type FinalSegment = {
  role: LiveRole;
  source: LiveSource;
  text: string;
};

type UseLiveCallCaptureOptions = {
  onFinalSegment: (segment: FinalSegment) => void;
  onStatusMessage?: (message: string) => void;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: (track?: MediaStreamTrack) => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const getPreferredMimeType = () => {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  if (typeof MediaRecorder === "undefined") return "";
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const startRecognitionWithOptionalTrack = (
  recognition: SpeechRecognitionLike,
  track?: MediaStreamTrack,
) => {
  if (!track) {
    recognition.start();
    return;
  }

  try {
    recognition.start(track);
  } catch {
    recognition.start();
  }
};

const finalizeResultText = (event: SpeechRecognitionEventLike) => {
  let interim = "";
  const finals: string[] = [];

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const alt = result?.[0];
    const text = alt?.transcript?.trim();
    if (!text) continue;

    if (result.isFinal) {
      finals.push(text);
    } else {
      interim = `${interim} ${text}`.trim();
    }
  }

  return { interim, finals };
};

const stopTracks = (stream?: MediaStream | null) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
};

export const useLiveCallCapture = (options: UseLiveCallCaptureOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [interimOperatorText, setInterimOperatorText] = useState("");
  const [interimCallerText, setInterimCallerText] = useState("");
  const [recordingReady, setRecordingReady] = useState(false);

  const [recognitionCtor, setRecognitionCtor] = useState<SpeechRecognitionCtor | null>(null);
  const supported = Boolean(recognitionCtor) && typeof navigator !== "undefined";

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ctor = getRecognitionCtor();
      setRecognitionCtor(() => ctor);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionsRef = useRef<{
    operator: SpeechRecognitionLike | null;
    caller: SpeechRecognitionLike | null;
  }>({
    operator: null,
    caller: null,
  });
  const keepRecognitionAliveRef = useRef(false);

  const stop = useCallback(() => {
    keepRecognitionAliveRef.current = false;

    const operatorRecognition = recognitionsRef.current.operator;
    if (operatorRecognition) {
      operatorRecognition.onend = null;
      operatorRecognition.onerror = null;
      operatorRecognition.onresult = null;
      try {
        operatorRecognition.stop();
      } catch {}
      try {
        operatorRecognition.abort();
      } catch {}
    }

    const callerRecognition = recognitionsRef.current.caller;
    if (callerRecognition) {
      callerRecognition.onend = null;
      callerRecognition.onerror = null;
      callerRecognition.onresult = null;
      try {
        callerRecognition.stop();
      } catch {}
      try {
        callerRecognition.abort();
      } catch {}
    }

    recognitionsRef.current = { operator: null, caller: null };

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    stopTracks(micStreamRef.current);
    stopTracks(systemStreamRef.current);
    stopTracks(mixedStreamRef.current);

    micStreamRef.current = null;
    systemStreamRef.current = null;
    mixedStreamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;

    setIsRecording(false);
    setHasSystemAudio(false);
    setInterimOperatorText("");
    setInterimCallerText("");
  }, []);

  const start = useCallback(async () => {
    if (!supported || !recognitionCtor) {
      throw new Error("В браузере нет поддержки Web Speech API.");
    }
    if (isRecording || isStarting) return;

    setIsStarting(true);
    setRecordingReady(false);
    chunksRef.current = [];

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = micStream;

      let systemStream: MediaStream | null = null;
      try {
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } catch {
        systemStream = null;
      }

      systemStreamRef.current = systemStream;
      const systemAudioTrack = systemStream?.getAudioTracks()?.[0] ?? null;
      const hasSystemTrack = Boolean(systemAudioTrack);
      setHasSystemAudio(hasSystemTrack);

      if (!hasSystemTrack) {
        optionsRef.current.onStatusMessage?.(
          "Системный звук не захвачен. Потоковая расшифровка будет только с микрофона.",
        );
      }

      const context = new AudioContext();
      audioContextRef.current = context;
      const destination = context.createMediaStreamDestination();

      const micSource = context.createMediaStreamSource(micStream);
      micSource.connect(destination);

      if (systemAudioTrack) {
        const systemAudioOnly = new MediaStream([systemAudioTrack]);
        const systemSource = context.createMediaStreamSource(systemAudioOnly);
        systemSource.connect(destination);
      }

      mixedStreamRef.current = destination.stream;

      const mimeType = getPreferredMimeType();
      const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) return;
        chunksRef.current.push(event.data);
        setRecordingReady(true);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      keepRecognitionAliveRef.current = true;

      const operatorRecognition = new recognitionCtor();
      operatorRecognition.lang = "ru-RU";
      operatorRecognition.continuous = true;
      operatorRecognition.interimResults = true;
      operatorRecognition.onresult = (event) => {
        const { interim, finals } = finalizeResultText(event);
        setInterimOperatorText(interim);
        finals.forEach((text) =>
          optionsRef.current.onFinalSegment({
            role: "Operator",
            source: "mic",
            text,
          }),
        );
      };
      operatorRecognition.onerror = (event) => {
        if (event?.error === "aborted") return;
        optionsRef.current.onStatusMessage?.("Ошибка распознавания микрофона.");
      };
      operatorRecognition.onend = () => {
        if (!keepRecognitionAliveRef.current) return;
        const track = micStream.getAudioTracks()?.[0];
        if (!track) return;
        try {
          startRecognitionWithOptionalTrack(operatorRecognition, track);
        } catch {}
      };

      const micTrack = micStream.getAudioTracks()?.[0];
      startRecognitionWithOptionalTrack(operatorRecognition, micTrack);
      recognitionsRef.current.operator = operatorRecognition;

      if (hasSystemTrack && systemAudioTrack) {
        const callerRecognition = new recognitionCtor();
        callerRecognition.lang = "ru-RU";
        callerRecognition.continuous = true;
        callerRecognition.interimResults = true;
        callerRecognition.onresult = (event) => {
          const { interim, finals } = finalizeResultText(event);
          setInterimCallerText(interim);
          finals.forEach((text) =>
            optionsRef.current.onFinalSegment({
              role: "Caller",
              source: "system",
              text,
            }),
          );
        };
        callerRecognition.onerror = (event) => {
          if (event?.error === "aborted") return;
          optionsRef.current.onStatusMessage?.(
            "Системная дорожка записывается, но потоковое распознавание второй стороны недоступно в текущем браузере.",
          );
        };
        callerRecognition.onend = () => {
          if (!keepRecognitionAliveRef.current) return;
          try {
            startRecognitionWithOptionalTrack(callerRecognition, systemAudioTrack);
          } catch {}
        };

        try {
          startRecognitionWithOptionalTrack(callerRecognition, systemAudioTrack);
          recognitionsRef.current.caller = callerRecognition;
        } catch {
          recognitionsRef.current.caller = null;
          setInterimCallerText("");
          optionsRef.current.onStatusMessage?.(
            "Системная дорожка записывается, но потоковое распознавание второй стороны недоступно в текущем браузере.",
          );
        }
      }

      setIsRecording(true);
    } catch (error) {
      stop();
      throw error;
    } finally {
      setIsStarting(false);
    }
  }, [isRecording, isStarting, recognitionCtor, stop, supported]);

  const downloadAudio = useCallback(() => {
    if (!chunksRef.current.length) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call-live-${Date.now()}.webm`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    supported,
    isRecording,
    isStarting,
    hasSystemAudio,
    interimOperatorText,
    interimCallerText,
    recordingReady,
    start,
    stop,
    downloadAudio,
  };
};
