import type { SerializedTab } from "@seans-browser/browser-core";
import { SleepOverlay } from "../SleepOverlay/SleepOverlay";

interface TabProps {
  tab: SerializedTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

const sleepIcons: Record<string, string> = {
  "soft-sleeping": "ZZ",
  "hard-sleeping": "HZ",
  crashed: "!"
};

export function Tab({ tab, isActive, onActivate, onClose }: TabProps) {
  const sleepIcon = sleepIcons[tab.state];
  const tabClassName = [
    "group relative grid min-w-[220px] max-w-[280px] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[10px] rounded-2xl border border-slate-400/15 bg-slate-800/70 px-3 py-[10px] text-slate-300 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-sky-300/35",
    isActive
      ? "border-sky-300/45 bg-[linear-gradient(180deg,rgba(37,99,235,0.26),rgba(15,23,42,0.92))] text-slate-50"
      : "",
    sleepIcon ? "opacity-95" : ""
  ].join(" ");

  return (
    <button
      className={tabClassName}
      onClick={onActivate}
      title={tab.title}
      type="button"
    >
      <div className="relative h-[18px] w-[18px]">
        {tab.favicon ? (
          <img className="rounded" src={tab.favicon} width={16} height={16} alt="" />
        ) : (
          <div className="h-4 w-4 rounded-[5px] bg-[linear-gradient(135deg,#22d3ee,#2563eb)]" />
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
        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-400/10 text-[12px] text-inherit"
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
