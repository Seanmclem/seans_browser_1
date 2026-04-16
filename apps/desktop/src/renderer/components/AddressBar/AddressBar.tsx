import { FormEvent, useEffect, useRef, useState } from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore } from "../../store/uiStore";

export function AddressBar() {
  const { activeTabId, tabs } = useTabStore();
  const focusNonce = useUIStore((state) => state.addressBarFocusNonce);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(activeTab?.url ?? "");
    }
  }, [activeTab?.url, isFocused]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusNonce]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTabId) {
      return;
    }
    void window.browserAPI.nav.loadURL(activeTabId, inputValue);
  };

  return (
    <form
      className="app-region-no-drag grid w-full grid-cols-[auto_1fr] items-center gap-[10px] rounded-[18px] border border-border bg-bg-base px-[14px] py-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      onSubmit={handleSubmit}
    >
      <span className="rounded-full bg-accent-subtle px-[10px] py-[6px] text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
        {activeTab?.url.startsWith("https://") ? "Secure" : "Web"}
      </span>
      <input
        ref={inputRef}
        className="w-full border-0 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
        value={isFocused ? inputValue : activeTab?.url ?? ""}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={(event) => {
          const input = event.currentTarget;
          setIsFocused(true);
          setInputValue(activeTab?.url ?? "");
          requestAnimationFrame(() => input.select());
        }}
        placeholder="Search or enter URL"
        spellCheck={false}
      />
    </form>
  );
}
