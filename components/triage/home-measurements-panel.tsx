"use client";

import { useMemo, useState } from "react";
import { ActivitySquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildVitalsSummary,
  MEASUREMENT_SOURCE_LABELS,
  normalizeHomeMeasurementsInput,
} from "@/lib/maternal-support";
import type {
  BleedingSeverity,
  FetalMovementStatus,
  HomeMeasurementsInput,
  MeasurementSource,
  PainSeverity,
} from "@/lib/types";

type HomeMeasurementsPanelProps = {
  value: HomeMeasurementsInput;
  suggestedValue: HomeMeasurementsInput;
  manualMode: boolean;
  onChange: (value: HomeMeasurementsInput) => void;
  onApplySuggested: () => void;
};

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const parsed = normalized.includes(".") ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export function HomeMeasurementsPanel({
  value,
  suggestedValue,
  manualMode,
  onChange,
  onApplySuggested,
}: HomeMeasurementsPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const update = (patch: Partial<HomeMeasurementsInput>) => {
    onChange(normalizeHomeMeasurementsInput({ ...value, ...patch }));
  };

  const updateBleeding = (patch: Partial<HomeMeasurementsInput["bleeding"]>) => {
    onChange(
      normalizeHomeMeasurementsInput({
        ...value,
        bleeding: { ...value.bleeding, ...patch },
      }),
    );
  };

  const updatePain = (patch: Partial<HomeMeasurementsInput["pain"]>) => {
    onChange(
      normalizeHomeMeasurementsInput({
        ...value,
        pain: { ...value.pain, ...patch },
      }),
    );
  };

  const summaryItems = useMemo(() => buildVitalsSummary(value).slice(0, 6), [value]);
  const suggestionChanged = JSON.stringify(value) !== JSON.stringify(suggestedValue);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={manualMode ? "secondary" : "outline"}
        className="gap-2"
        onClick={() => setSheetOpen(true)}
      >
        <ActivitySquare className="h-4 w-4" />
        Показатели
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Домашние показатели</SheetTitle>
            <SheetDescription>
              Автоматически извлекаются из текста звонка. Здесь только ручное уточнение измерений.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-5 py-2">
              <div className="space-y-3 rounded-2xl border border-border/70 bg-surface-2/45 p-4">
                <div className="flex flex-wrap gap-2">
                  {manualMode ? <Badge variant="secondary">Есть ручные правки</Badge> : null}
                  {summaryItems.length ? (
                    summaryItems.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">Извлеченных измерений пока нет</Badge>
                  )}
                </div>

                {suggestionChanged ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/20 p-3">
                    <p className="text-sm text-muted-foreground">
                      В транскрипте уже есть сигналы, которые можно заново подтянуть в форму.
                    </p>
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={onApplySuggested}>
                      <Sparkles className="h-3.5 w-3.5" />
                      Перезаполнить из звонка
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gestation-weeks">Срок, нед</Label>
                  <Input
                    id="gestation-weeks"
                    value={value.gestation_weeks ?? ""}
                    onChange={(event) => update({ gestation_weeks: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Источник</Label>
                  <Select
                    value={value.measurement_source}
                    onValueChange={(next) => update({ measurement_source: next as MeasurementSource })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите источник" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEASUREMENT_SOURCE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="systolic-bp">Систолическое АД</Label>
                  <Input
                    id="systolic-bp"
                    value={value.systolic_bp ?? ""}
                    onChange={(event) => update({ systolic_bp: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diastolic-bp">Диастолическое АД</Label>
                  <Input
                    id="diastolic-bp"
                    value={value.diastolic_bp ?? ""}
                    onChange={(event) => update({ diastolic_bp: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pulse">Пульс</Label>
                  <Input
                    id="pulse"
                    value={value.pulse ?? ""}
                    onChange={(event) => update({ pulse: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spo2">SpO2</Label>
                  <Input
                    id="spo2"
                    value={value.spo2 ?? ""}
                    onChange={(event) => update({ spo2: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature">Температура</Label>
                  <Input
                    id="temperature"
                    value={value.temperature ?? ""}
                    onChange={(event) => update({ temperature: toNumberOrNull(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurement-time">Время измерения</Label>
                  <Input
                    id="measurement-time"
                    type="datetime-local"
                    value={value.measurement_time ?? ""}
                    onChange={(event) => update({ measurement_time: event.target.value || null })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Кровотечение</Label>
                  <Select
                    value={value.bleeding.severity}
                    onValueChange={(next) =>
                      updateBleeding({
                        severity: next as BleedingSeverity,
                        present: next === "none" ? false : next === "unknown" ? null : true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Уточните кровотечение" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Не уточнено</SelectItem>
                      <SelectItem value="none">Нет</SelectItem>
                      <SelectItem value="spotting">Мажущие выделения</SelectItem>
                      <SelectItem value="moderate">Умеренное</SelectItem>
                      <SelectItem value="heavy">Обильное</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bleeding-note">Комментарий по кровотечению</Label>
                  <Input
                    id="bleeding-note"
                    value={value.bleeding.note ?? ""}
                    onChange={(event) => updateBleeding({ note: event.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Боль</Label>
                  <Select
                    value={value.pain.severity}
                    onValueChange={(next) =>
                      updatePain({
                        severity: next as PainSeverity,
                        present: next === "none" ? false : next === "unknown" ? null : true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Уточните интенсивность боли" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Не уточнено</SelectItem>
                      <SelectItem value="none">Нет боли</SelectItem>
                      <SelectItem value="mild">Слабая</SelectItem>
                      <SelectItem value="moderate">Умеренная</SelectItem>
                      <SelectItem value="severe">Сильная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pain-location">Локализация/характер боли</Label>
                  <Input
                    id="pain-location"
                    value={value.pain.location ?? ""}
                    onChange={(event) => updatePain({ location: event.target.value || null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Шевеления плода</Label>
                <Select
                  value={value.fetal_movement}
                  onValueChange={(next) => update({ fetal_movement: next as FetalMovementStatus })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Уточните шевеления" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Не уточнено</SelectItem>
                    <SelectItem value="normal">Обычные</SelectItem>
                    <SelectItem value="reduced">Снижены</SelectItem>
                    <SelectItem value="absent">Не ощущаются</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
