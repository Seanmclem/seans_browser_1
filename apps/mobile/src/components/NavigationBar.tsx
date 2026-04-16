import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { browserTheme } from "@seans-browser/browser-theme";

const ACTION_CLASS = "rounded-[14px] bg-bg-surface px-[14px] py-[10px]";
const DISABLED_ACTION_CLASS = `${ACTION_CLASS} opacity-40`;
const ACTION_TEXT_CLASS = "font-semibold text-text-primary";

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
    <View className="gap-3">
      <View className="flex-row gap-[10px]">
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!props.canGoBack}
          onPress={props.onBack}
          className={props.canGoBack ? ACTION_CLASS : DISABLED_ACTION_CLASS}
        >
          <Text className={ACTION_TEXT_CLASS}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!props.canGoForward}
          onPress={props.onForward}
          className={props.canGoForward ? ACTION_CLASS : DISABLED_ACTION_CLASS}
        >
          <Text className={ACTION_TEXT_CLASS}>Next</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={props.onReload} className={ACTION_CLASS}>
          <Text className={ACTION_TEXT_CLASS}>{props.isLoading ? "Load" : "Reload"}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmit}
        placeholder="Search or enter URL"
        placeholderTextColor={browserTheme.dark["text-muted"]}
        className="rounded-[18px] border border-border bg-bg-base px-4 py-[14px] text-text-primary"
        value={props.value}
      />
    </View>
  );
}
