"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, PlugZap, TestTube2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/contexts/app-store";
import { STORAGE_KEYS } from "@/lib/constants";
import { DEMO_PRESETS } from "@/lib/mock-data";
import { RUN_ENDPOINT } from "@/lib/yc-config";

export default function SettingsPage() {
  const router = useRouter();
  const { settings, setSettings } = useAppStore();
  const [testLoading, setTestLoading] = useState(false);
  const [testState, setTestState] = useState<"idle" | "ok" | "error">("idle");

  const effectiveEndpoint = settings.workflowEndpoint.trim();

  const mode = useMemo(() => {
    return effectiveEndpoint ? "Реальный режим" : "Демо-режим";
  }, [effectiveEndpoint]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} скопирован`);
    } catch {
      toast.error(`Не удалось скопировать ${label}`);
    }
  };

  const launchDemoPreset = (presetId: string, label: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.PENDING_DEMO_PRESET, presetId);
    }
    toast.success(`Подготовлен демо-сценарий: ${label}`);
    router.push("/triage");
  };

  const runConnectionTest = async () => {
    setTestLoading(true);
    setTestState("idle");

    try {
      const response = await fetch("/api/run-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: "ВЫЗОВ-НАСТРОЙКИ-ТЕСТ",
          transcript:
            "[00:05] Диспетчер: Скорая, что случилось? [00:10] Звонящая: 34 неделя, кровь и сильная боль, схватки каждые 4 минуты.",
          trace: settings.traceEnabled,
          endpoint: effectiveEndpoint || undefined,
        }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Проверка подключения завершилась ошибкой");
      }

      setTestState("ok");
      toast.success("Проверка подключения успешна");
    } catch (error) {
      setTestState("error");
      toast.error(error instanceof Error ? error.message : "Проверка подключения завершилась ошибкой");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
          <p className="text-sm text-muted-foreground">
            Управление режимом (демо/реальный), адресом сервиса и диагностикой подключения.
          </p>
        </div>
        <Badge variant={mode === "Реальный режим" ? "success" : "secondary"}>{mode}</Badge>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Переключение режима
          </CardTitle>
          <CardDescription>
            Выберите, работать с подключенным адресом сервиса или использовать локальный демонстрационный сценарий.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant={effectiveEndpoint ? "default" : "secondary"}
            onClick={() => {
              setSettings({ workflowEndpoint: RUN_ENDPOINT });
              toast.success("Включен реальный режим");
            }}
          >
            Использовать внешний сервис
          </Button>
          <Button
            variant={!effectiveEndpoint ? "default" : "outline"}
            onClick={() => {
              setSettings({ workflowEndpoint: "" });
              toast.message("Включен демо-режим");
            }}
          >
            Переключить в демо-режим
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Демо-сценарии (ручной запуск)</CardTitle>
          <CardDescription>
            Демо-сценарии убраны с рабочего экрана. Выберите сценарий здесь, после чего откроется экран с
            подготовленным транскриптом.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => launchDemoPreset(preset.id, preset.label)}
              className="rounded-xl border border-border bg-surface-2/60 p-3 text-left transition hover:border-primary/45 hover:bg-surface-2"
            >
              <p className="text-sm font-medium text-foreground">{preset.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            Адрес запуска оркестрации
          </CardTitle>
          <CardDescription>
            Если поле пустое, приложение работает в демо-режиме с локальными демонстрационными данными.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="workflow-endpoint">Адрес запуска (WORKFLOW_RUN_ENDPOINT)</Label>
          <Input
            id="workflow-endpoint"
            placeholder={RUN_ENDPOINT}
            value={settings.workflowEndpoint}
            onChange={(event) => setSettings({ workflowEndpoint: event.target.value })}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setSettings({ workflowEndpoint: RUN_ENDPOINT })}>
              Подставить адрес по умолчанию
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void copyText(RUN_ENDPOINT, "адрес по умолчанию");
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Скопировать адрес
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            При нажатии «Запустить сортировку» интерфейс отправляет запрос в локальный служебный маршрут, который
            перенаправляет вызов на этот адрес.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Адрес сервиса базы знаний (необязательно)</CardTitle>
          <CardDescription>Используется на странице /kb, иначе применяется локальный демонстрационный маршрут.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="kb-endpoint">Адрес сервиса базы знаний</Label>
          <Input
            id="kb-endpoint"
            placeholder="https://ваш-сервис.example.com/search"
            value={settings.kbEndpoint}
            onChange={(event) => setSettings({ kbEndpoint: event.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поведение интерфейса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 p-3">
            <div>
              <p className="text-sm font-medium">Добавлять трассировку в запрос запуска</p>
              <p className="text-xs text-muted-foreground">Запрашивать историю выполнения и показывать панель трассировки.</p>
            </div>
            <Switch
              checked={settings.traceEnabled}
              onCheckedChange={(next) => setSettings({ traceEnabled: Boolean(next) })}
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 p-3">
            <div>
              <p className="text-sm font-medium">Исходный JSON открыт по умолчанию</p>
              <p className="text-xs text-muted-foreground">Применяется к панели технических данных на рабочем экране.</p>
            </div>
            <Switch
              checked={settings.rawJsonDefaultOpen}
              onCheckedChange={(next) => setSettings({ rawJsonDefaultOpen: Boolean(next) })}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-4 w-4" />
            Проверка подключения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => void runConnectionTest()} disabled={testLoading}>
            {testLoading ? "Проверка..." : "Запустить тест"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Тест выполняет полный цикл запуска и опроса через локальный служебный маршрут с текущим адресом сервиса.
          </p>

          {testState === "ok" ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Тест адреса сервиса выполнен успешно.
            </p>
          ) : null}

          {testState === "error" ? (
            <p className="text-sm text-danger">Тест адреса сервиса завершился ошибкой. Проверьте адрес и журнал сервера.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
