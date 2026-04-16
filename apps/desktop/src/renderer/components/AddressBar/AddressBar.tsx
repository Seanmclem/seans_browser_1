import { FormEvent, useEffect, useRef, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore } from "../../store/uiStore";

export function AddressBar() {
  const { activeTabId, tabs } = useTabStore();
  const focusNonce = useUIStore((state) => state.addressBarFocusNonce);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const isSecure = activeTab?.url.startsWith("https://") ?? false;

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
      <span
        aria-label={isSecure ? "Secure connection" : "Not secure"}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
          isSecure ? "bg-emerald-500 text-white" : "bg-red-200 text-red-800"
        }`}
        title={isSecure ? "Secure connection" : "Not secure"}
      >
        {isSecure ? (
          <Lock aria-hidden size={15} strokeWidth={2.6} />
        ) : (
          <LockOpen aria-hidden size={15} strokeWidth={2.6} />
        )}
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
