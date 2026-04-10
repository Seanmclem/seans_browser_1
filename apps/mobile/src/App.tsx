import { useEffect, useMemo, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { normalizeURL } from "@seans-browser/browser-core";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { NavigationBar } from "./components/NavigationBar";
import { TabStrip } from "./components/TabStrip";
import { useSleepWatcher } from "./hooks/useSleepWatcher";
import { useBrowserStore } from "./store/browserStore";

export default function App() {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const draftAddress = useBrowserStore((state) => state.draftAddress);
  const createTab = useBrowserStore((state) => state.createTab);
  const closeTab = useBrowserStore((state) => state.closeTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setDraftAddress = useBrowserStore((state) => state.setDraftAddress);
  useSleepWatcher();

  const webViewRefs = useRef<Record<string, WebView | null>>({});
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  useEffect(() => {
    if (tabs.length === 0) {
      createTab();
    }
  }, [createTab, tabs.length]);

  const handleSubmit = () => {
    if (!activeTabId) {
      return;
    }
    updateTab(activeTabId, {
      url: normalizeURL(draftAddress),
      isLoading: true,
      state: "active"
    });
  };

  const handleNavigationStateChange = (tabId: string, navigation: WebViewNavigation) => {
    updateTab(tabId, {
      url: navigation.url,
      title: navigation.title || navigation.url,
      canGoBack: navigation.canGoBack,
      canGoForward: navigation.canGoForward,
      isLoading: navigation.loading
    });
  };

  const invokeActive = (action: "back" | "forward" | "reload") => {
    if (!activeTabId) {
      return;
    }

    const ref = webViewRefs.current[activeTabId];
    if (!ref) {
      return;
    }

    if (action === "back") {
      ref.goBack();
      return;
    }

    if (action === "forward") {
      ref.goForward();
      return;
    }

    ref.reload();
  };

  return (
    <View style={styles.background}>
      <View style={[styles.orb, styles.orbOne]} />
      <View style={[styles.orb, styles.orbTwo]} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          style={styles.container}
        >
          <View style={styles.chrome}>
            <Text style={styles.eyebrow}>SeanBrowser Mobile</Text>
            <Text style={styles.title}>Expo browser shell with tab sleep states</Text>
            <TabStrip
              activeTabId={activeTabId}
              onActivate={setActiveTab}
              onClose={closeTab}
              onCreate={() => createTab()}
              tabs={tabs}
            />
            <NavigationBar
              canGoBack={Boolean(activeTab?.canGoBack)}
              canGoForward={Boolean(activeTab?.canGoForward)}
              isLoading={Boolean(activeTab?.isLoading)}
              onBack={() => invokeActive("back")}
              onChangeText={setDraftAddress}
              onForward={() => invokeActive("forward")}
              onReload={() => invokeActive("reload")}
              onSubmit={handleSubmit}
              value={draftAddress}
            />
          </View>

          <View style={styles.viewport}>
            {tabs.map((tab) => {
              if (tab.state === "hard-sleeping" && tab.id !== activeTabId) {
                return null;
              }

              const visible = tab.id === activeTabId;
              return (
                <View
                  key={`${tab.id}:${tab.reloadToken}`}
                  pointerEvents={visible ? "auto" : "none"}
                  style={[styles.webViewShell, visible ? styles.webViewVisible : styles.webViewHidden]}
                >
                  <WebView
                    ref={(instance) => {
                      webViewRefs.current[tab.id] = instance;
                    }}
                    onLoadEnd={() => updateTab(tab.id, { isLoading: false })}
                    onNavigationStateChange={(navigation) =>
                      handleNavigationStateChange(tab.id, navigation)
                    }
                    setSupportMultipleWindows={false}
                    source={{ uri: normalizeURL(tab.url) }}
                    style={styles.webView}
                  />
                </View>
              );
            })}

            {!activeTab ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active tab</Text>
                <TouchableOpacity onPress={() => createTab()} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Open a new tab</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#020617"
  },
  orb: {
    position: "absolute",
    borderRadius: 9999
  },
  orbOne: {
    width: 240,
    height: 240,
    top: -40,
    right: -30,
    backgroundColor: "rgba(34,211,238,0.16)"
  },
  orbTwo: {
    width: 320,
    height: 320,
    bottom: 80,
    left: -90,
    backgroundColor: "rgba(249,115,22,0.10)"
  },
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.58)"
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14
  },
  chrome: {
    marginTop: 8,
    padding: 18,
    borderRadius: 28,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.16)",
    gap: 14
  },
  eyebrow: {
    color: "#67e8f9",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 11,
    fontWeight: "700"
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "700"
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    backgroundColor: "rgba(2,6,23,0.82)"
  },
  webViewShell: {
    ...StyleSheet.absoluteFillObject
  },
  webViewVisible: {
    opacity: 1
  },
  webViewHidden: {
    opacity: 0
  },
  webView: {
    flex: 1,
    backgroundColor: "#fff"
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700"
  },
  emptyButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#22d3ee"
  },
  emptyButtonText: {
    color: "#082f49",
    fontWeight: "700"
  }
});
