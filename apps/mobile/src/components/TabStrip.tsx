import { ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { Bed, Moon, OctagonAlert, Plus, X } from "lucide-react-native";
import { browserTheme } from "@seans-browser/browser-theme";
import type { MobileTab } from "../store/browserStore";

interface TabStripProps {
  tabs: MobileTab[];
  activeTabId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
}

export function TabStrip({ tabs, activeTabId, onActivate, onClose, onCreate }: TabStripProps) {
  const colorScheme = useColorScheme();
  const theme = browserTheme[colorScheme === "light" ? "light" : "dark"];

  return (
    <View className="flex-row items-center gap-[10px]">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-[10px] pr-[10px]"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.86}
              onPress={() => onActivate(tab.id)}
              className={`min-w-[180px] max-w-[220px] flex-row items-center gap-2 rounded-[18px] border px-[14px] py-3 ${
                isActive
                  ? "border-tab-border-active bg-accent-subtle"
                  : "border-border bg-bg-surface"
              }`}
            >
              <Text
                numberOfLines={1}
                className={`flex-1 text-[13px] font-semibold ${
                  isActive ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {tab.title || tab.url}
              </Text>
              {tab.state === "soft-sleeping" ? (
                <Bed color={theme.accent} size={14} strokeWidth={2.4} />
              ) : tab.state === "hard-sleeping" ? (
                <Moon color={theme.accent} size={14} strokeWidth={2.4} />
              ) : tab.state === "crashed" ? (
                <OctagonAlert color={theme.accent} size={14} strokeWidth={2.4} />
              ) : null}
              <TouchableOpacity
                accessibilityLabel="Close tab"
                onPress={() => onClose(tab.id)}
                className="h-[22px] w-[22px] items-center justify-center rounded-full bg-bg-base/30"
              >
                <X color={theme["text-primary"]} size={13} strokeWidth={2.4} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        activeOpacity={0.88}
        accessibilityLabel="Open a new tab"
        onPress={onCreate}
        className="h-[42px] w-[42px] items-center justify-center rounded-2xl bg-accent"
      >
        <Plus color={theme["bg-base"]} size={24} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}
