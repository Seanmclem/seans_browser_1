import type { MouseEvent } from "react";
import type { SerializedTab } from "@seans-browser/browser-core";
import { SleepOverlay } from "../SleepOverlay/SleepOverlay";

interface TabProps {
  tab: SerializedTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}

const sleepIcons: Record<string, string> = {
  "soft-sleeping": "ZZ",
  "hard-sleeping": "HZ",
  crashed: "!"
};

export function Tab({ tab, isActive, onActivate, onClose, onContextMenu }: TabProps) {
  const sleepIcon = sleepIcons[tab.state];
  const tabClassName = [
    "app-region-no-drag group relative grid min-w-[220px] max-w-[280px] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[10px] rounded-2xl border px-3 py-[10px] transition-colors duration-150",
    isActive
      ? "border-cyan-200/80 bg-sky-600 text-slate-50 hover:border-cyan-200/80 hover:bg-sky-600"
      : "border-slate-500/45 bg-slate-700/70 text-slate-300 hover:border-slate-300/45 hover:bg-slate-700/95",
    sleepIcon ? "opacity-95" : ""
  ].join(" ");

  return (
    <button
      className={tabClassName}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      title={tab.title}
      type="button"
    >
      <div className="relative h-[18px] w-[18px]">
        {tab.favicon ? (
          <img className="rounded" src={tab.favicon} width={16} height={16} alt="" />
        ) : (
          <div className="h-4 w-4 rounded-[5px] bg-sky-500" />
        )}
        {sleepIcon ? (
          <span className="absolute -bottom-2 -right-2 h-4 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[8px] font-bold leading-4 text-slate-900">
            {sleepIcon}
          </span>
        ) : null}
      </div>

      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px]">
        {tab.title || tab.url}
      </span>

      <span
        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-400/10 text-[12px] text-inherit transition-colors duration-150 hover:bg-slate-300/20"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        x
      </span>

      {tab.snapshot && !isActive ? (
        <div className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <SleepOverlay snapshot={tab.snapshot} state={tab.state} />
        </div>
      ) : null}
    </button>
  );
}
