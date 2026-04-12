import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { MobileTab } from "../store/browserStore";

interface TabStripProps {
  tabs: MobileTab[];
  activeTabId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
}

export function TabStrip({ tabs, activeTabId, onActivate, onClose, onCreate }: TabStripProps) {
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
                  ? "border-cyan-300/45 bg-cyan-700/25"
                  : "border-slate-400/15 bg-slate-900/60"
              }`}
            >
              <Text
                numberOfLines={1}
                className={`flex-1 text-[13px] font-semibold ${
                  isActive ? "text-slate-50" : "text-blue-100"
                }`}
              >
                {tab.title || tab.url}
              </Text>
              <Text className="text-[10px] uppercase text-orange-500">
                {tab.state === "soft-sleeping"
                  ? "soft"
                  : tab.state === "hard-sleeping"
                    ? "hard"
                    : ""}
              </Text>
              <TouchableOpacity
                onPress={() => onClose(tab.id)}
                className="h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-400/15"
              >
                <Text className="text-white">x</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onCreate}
        className="h-[42px] w-[42px] items-center justify-center rounded-2xl bg-cyan-400"
      >
        <Text className="text-[26px] text-cyan-950">+</Text>
      </TouchableOpacity>
    </View>
  );
}
