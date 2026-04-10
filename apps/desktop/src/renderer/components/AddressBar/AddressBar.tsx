import { FormEvent, useEffect, useRef, useState } from "react";
import { useTabStore } from "../../store/tabStore";
import { useUIStore } from "../../store/uiStore";
import styles from "./AddressBar.module.css";

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
    <form className={styles.addressBar} onSubmit={handleSubmit}>
      <span className={styles.security}>{activeTab?.url.startsWith("https://") ? "Secure" : "Web"}</span>
      <input
        ref={inputRef}
        className={styles.urlInput}
        value={isFocused ? inputValue : activeTab?.url ?? ""}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder="Search or enter URL"
        spellCheck={false}
      />
    </form>
  );
}

