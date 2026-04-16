import { useEffect, useMemo, useRef } from "react";
import "./global.css";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  useColorScheme,
  type ViewStyle,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { normalizeURL } from "@seans-browser/browser-core";
import { browserTheme } from "@seans-browser/browser-theme";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { NavigationBar } from "./components/NavigationBar";
import { TabStrip } from "./components/TabStrip";
import { useSleepWatcher } from "./hooks/useSleepWatcher";
import { useBrowserStore } from "./store/browserStore";
import { WEB_VIEW_MEDIA_POLICY_PROPS } from "./webViewMediaPolicy";

const WEB_VIEW_STYLE: ViewStyle = { flex: 1, backgroundColor: browserTheme.light["bg-surface"] };

export default function App() {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const draftAddress = useBrowserStore((state) => state.draftAddress);
  const createTab = useBrowserStore((state) => state.createTab);
  const closeTab = useBrowserStore((state) => state.closeTab);
  const setActiveTab = useBrowserStore((state) => state.setActiveTab);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const setDraftAddress = useBrowserStore((state) => state.setDraftAddress);
  const colorScheme = useColorScheme();
  const themeClassName = colorScheme === "light" ? "theme-light" : "theme-dark";
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
    <View className={`${themeClassName} flex-1 bg-bg-base`}>
      <View className="absolute -right-[30px] -top-10 h-[240px] w-[240px] rounded-full bg-accent/[0.16]" />
      <View className="absolute -left-[90px] bottom-20 h-[320px] w-[320px] rounded-full bg-accent-subtle/30" />
      <SafeAreaView className="flex-1 bg-bg-base/60">
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          className="flex-1 gap-[14px] px-4 pb-4"
        >
          <View className="mt-2 gap-[14px] rounded-[28px] border border-border bg-bg-chrome p-[18px]">
            <Text className="text-[11px] font-bold uppercase tracking-[1.4px] text-accent">
              SeanBrowser Mobile
            </Text>
            <Text className="text-[28px] font-bold leading-[31px] text-text-primary">
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

          <View className="flex-1 overflow-hidden rounded-[30px] border border-border bg-bg-base">
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
                    {...WEB_VIEW_MEDIA_POLICY_PROPS}
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
                <Text className="text-[22px] font-bold text-text-primary">No active tab</Text>
                <TouchableOpacity
                  onPress={() => createTab()}
                  className="rounded-full bg-accent px-[18px] py-3"
                >
                  <Text className="font-bold text-bg-base">Open a new tab</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
