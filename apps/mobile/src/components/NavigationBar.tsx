import { TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import { ArrowLeft, ArrowRight, Lock, LockOpen, RotateCw } from "lucide-react-native";
import { browserTheme } from "@seans-browser/browser-theme";

const ACTION_CLASS = "h-10 w-10 items-center justify-center rounded-[14px] bg-bg-surface";
const DISABLED_ACTION_CLASS = `${ACTION_CLASS} opacity-40`;

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
  const colorScheme = useColorScheme();
  const theme = browserTheme[colorScheme === "light" ? "light" : "dark"];
  const isSecure = props.value.startsWith("https://");

  return (
    <View className="gap-3">
      <View className="flex-row gap-[10px]">
        <TouchableOpacity
          accessibilityLabel="Go back"
          activeOpacity={0.85}
          disabled={!props.canGoBack}
          onPress={props.onBack}
          className={props.canGoBack ? ACTION_CLASS : DISABLED_ACTION_CLASS}
        >
          <ArrowLeft color={theme["text-primary"]} size={19} strokeWidth={2.3} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Go forward"
          activeOpacity={0.85}
          disabled={!props.canGoForward}
          onPress={props.onForward}
          className={props.canGoForward ? ACTION_CLASS : DISABLED_ACTION_CLASS}
        >
          <ArrowRight color={theme["text-primary"]} size={19} strokeWidth={2.3} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel={props.isLoading ? "Reload page while loading" : "Reload page"}
          activeOpacity={0.85}
          onPress={props.onReload}
          className={ACTION_CLASS}
        >
          <RotateCw color={theme["text-primary"]} size={18} strokeWidth={2.3} />
        </TouchableOpacity>
      </View>
      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-bg-base px-3 py-[10px]">
        <View
          accessibilityLabel={isSecure ? "Secure connection" : "Not secure"}
          className={`h-8 w-8 items-center justify-center rounded-full ${
            isSecure ? "bg-green-600" : "bg-red-200"
          }`}
        >
          {isSecure ? (
            <Lock color="#ffffff" size={15} strokeWidth={2.6} />
          ) : (
            <LockOpen color="#991b1b" size={15} strokeWidth={2.6} />
          )}
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={props.onChangeText}
          onSubmitEditing={props.onSubmit}
          placeholder="Search or enter URL"
          placeholderTextColor={theme["text-muted"]}
          className="flex-1 py-1 text-text-primary"
          value={props.value}
        />
      </View>
    </View>
  );
}
