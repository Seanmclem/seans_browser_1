interface SleepOverlayProps {
  snapshot: string;
  state: string;
}

export function SleepOverlay({ snapshot, state }: SleepOverlayProps) {
  return (
    <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[220px] rounded-[14px] border border-slate-400/20 bg-slate-900/95 p-2 shadow-[0_20px_36px_rgba(2,6,23,0.34)]">
      <img
        className="block aspect-[16/10] w-full rounded-[10px] object-cover"
        src={snapshot}
        alt="Sleeping tab preview"
      />
      <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-blue-100">
        {state === "hard-sleeping" ? "Hard Sleep" : "Soft Sleep"}
      </div>
    </div>
  );
}
