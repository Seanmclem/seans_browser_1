import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

interface NavigationBarProps {
  value: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onSubmit: () => void;
  onChangeText: (value: string) => void;
}

export function NavigationBar(props: NavigationBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!props.canGoBack}
          onPress={props.onBack}
          style={[styles.action, !props.canGoBack && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!props.canGoForward}
          onPress={props.onForward}
          style={[styles.action, !props.canGoForward && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>Next</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={props.onReload} style={styles.action}>
          <Text style={styles.actionText}>{props.isLoading ? "Load" : "Reload"}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmit}
        placeholder="Search or enter URL"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={props.value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.62)"
  },
  actionDisabled: {
    opacity: 0.4
  },
  actionText: {
    color: "#f8fafc",
    fontWeight: "600"
  },
  input: {
    borderRadius: 18,
    backgroundColor: "rgba(2,6,23,0.76)",
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.2)",
    color: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 14
  }
});

