import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.86}
              onPress={() => onActivate(tab.id)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text numberOfLines={1} style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.title || tab.url}
              </Text>
              <Text style={styles.badge}>
                {tab.state === "soft-sleeping"
                  ? "soft"
                  : tab.state === "hard-sleeping"
                    ? "hard"
                    : ""}
              </Text>
              <TouchableOpacity onPress={() => onClose(tab.id)} style={styles.close}>
                <Text style={styles.closeText}>x</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity activeOpacity={0.88} onPress={onCreate} style={styles.add}>
        <Text style={styles.addText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  list: {
    gap: 10,
    paddingRight: 10
  },
  tab: {
    minWidth: 180,
    maxWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.62)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)"
  },
  tabActive: {
    backgroundColor: "rgba(8,145,178,0.26)",
    borderColor: "rgba(103,232,249,0.44)"
  },
  tabText: {
    flex: 1,
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#f8fafc"
  },
  badge: {
    color: "#f97316",
    fontSize: 10,
    textTransform: "uppercase"
  },
  close: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.16)"
  },
  closeText: {
    color: "#fff"
  },
  add: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22d3ee"
  },
  addText: {
    fontSize: 26,
    color: "#082f49"
  }
});

