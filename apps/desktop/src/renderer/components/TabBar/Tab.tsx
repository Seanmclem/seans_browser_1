import type { DragEvent, MouseEvent } from "react";
import type { SerializedTab } from "@seans-browser/browser-core";
import { Bed, Moon, OctagonAlert, X } from "lucide-react";
import { SleepOverlay } from "../SleepOverlay/SleepOverlay";

interface TabProps {
  tab: SerializedTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  orientation?: "horizontal" | "vertical";
}

const sleepIconLabels: Record<string, string> = {
  "soft-sleeping": "Soft sleeping",
  "hard-sleeping": "Hard sleeping",
  crashed: "Crashed"
};

export function Tab({
  tab,
  isActive,
  onActivate,
  onClose,
  onContextMenu,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  orientation = "horizontal"
}: TabProps) {
  const sleepIconLabel = sleepIconLabels[tab.state];
  const tabClassName = [
    "app-region-no-drag group relative grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[10px] rounded-2xl border px-3 py-[10px] transition-colors duration-150",
    orientation === "vertical" ? "w-full min-w-0" : "min-w-[220px] max-w-[280px]",
    isActive
      ? "border-tab-border-active bg-accent text-bg-base hover:border-tab-border-active hover:bg-accent"
      : "border-border bg-bg-surface text-text-muted hover:border-tab-border-active/60 hover:bg-accent-subtle",
    sleepIconLabel ? "opacity-95" : ""
  ].join(" ");

  return (
    <button
      className={tabClassName}
      draggable={tab.state !== "hard-sleeping"}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      title={tab.title}
      type="button"
    >
      <div className="relative h-[18px] w-[18px]">
        {tab.favicon ? (
          <img className="rounded" src={tab.favicon} width={16} height={16} alt="" />
        ) : (
          <div className="h-4 w-4 rounded-[5px] bg-accent" />
        )}
        {sleepIconLabel ? (
          <span
            aria-label={sleepIconLabel}
            className="absolute -bottom-2 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-subtle px-1 text-accent"
            title={sleepIconLabel}
          >
            {tab.state === "soft-sleeping" ? (
              <Bed aria-hidden size={10} strokeWidth={2.6} />
            ) : tab.state === "hard-sleeping" ? (
              <Moon aria-hidden size={10} strokeWidth={2.6} />
            ) : (
              <OctagonAlert aria-hidden size={10} strokeWidth={2.6} />
            )}
          </span>
        ) : null}
      </div>

      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px]">
        {tab.title || tab.url}
      </span>

      <span
        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-bg-base/30 text-[12px] text-inherit transition-colors duration-150 hover:bg-bg-base/50"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X aria-hidden size={13} strokeWidth={2.4} />
      </span>

      {tab.snapshot && !isActive ? (
        <div className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <SleepOverlay snapshot={tab.snapshot} state={tab.state} />
        </div>
      ) : null}
    </button>
  );
}
