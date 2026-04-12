import { useEffect, useMemo, useRef } from "react";
import "./global.css";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  type ViewStyle,
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

const WEB_VIEW_STYLE: ViewStyle = { flex: 1, backgroundColor: "#fff" };

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
    <View className="flex-1 bg-[#020617]">
      <View className="absolute -right-[30px] -top-10 h-[240px] w-[240px] rounded-full bg-cyan-400/[0.16]" />
      <View className="absolute -left-[90px] bottom-20 h-[320px] w-[320px] rounded-full bg-orange-500/10" />
      <SafeAreaView className="flex-1 bg-slate-950/60">
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          className="flex-1 gap-[14px] px-4 pb-4"
        >
          <View className="mt-2 gap-[14px] rounded-[28px] border border-cyan-300/15 bg-slate-900/70 p-[18px]">
            <Text className="text-[11px] font-bold uppercase tracking-[1.4px] text-cyan-300">
              SeanBrowser Mobile
            </Text>
            <Text className="text-[28px] font-bold leading-[31px] text-slate-50">
              Expo browser shell with tab sleep states
            </Text>
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

          <View className="flex-1 overflow-hidden rounded-[30px] border border-slate-400/10 bg-slate-950/80">
            {tabs.map((tab) => {
              if (tab.state === "hard-sleeping" && tab.id !== activeTabId) {
                return null;
              }

              const visible = tab.id === activeTabId;
              return (
                <View
                  key={`${tab.id}:${tab.reloadToken}`}
                  pointerEvents={visible ? "auto" : "none"}
                  className={`absolute inset-0 ${visible ? "opacity-100" : "opacity-0"}`}
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
                    style={WEB_VIEW_STYLE}
                  />
                </View>
              );
            })}

            {!activeTab ? (
              <View className="flex-1 items-center justify-center gap-[14px]">
                <Text className="text-[22px] font-bold text-white">No active tab</Text>
                <TouchableOpacity
                  onPress={() => createTab()}
                  className="rounded-full bg-cyan-400 px-[18px] py-3"
                >
                  <Text className="font-bold text-cyan-950">Open a new tab</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
