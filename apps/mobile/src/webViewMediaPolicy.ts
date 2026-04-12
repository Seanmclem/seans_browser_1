import { Platform } from "react-native";
import type { WebViewProps } from "react-native-webview";

const IOS_FRAME_INJECTION_PROPS: Partial<WebViewProps> =
  Platform.OS === "ios"
    ? {
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly: false,
        injectedJavaScriptForMainFrameOnly: false
      }
    : {};

const MEDIA_POLICY_SCRIPT = `
(() => {
  const patchMedia = (root) => {
    const mediaNodes = [
      ...(root.matches?.("video,audio") ? [root] : []),
      ...(root.querySelectorAll?.("video,audio") ?? [])
    ];

    mediaNodes.forEach((node) => {
      node.autoplay = false;
      node.removeAttribute("autoplay");
      node.setAttribute("playsinline", "");
      node.setAttribute("webkit-playsinline", "");
      node.setAttribute("x-webkit-airplay", "deny");

      if ("disablePictureInPicture" in node) {
        node.disablePictureInPicture = true;
      }
    });
  };

  const start = () => {
    patchMedia(document);

    // Ad players commonly inject media into nested frames after page load.
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            patchMedia(node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
true;
`;

export const WEB_VIEW_MEDIA_POLICY_PROPS: Partial<WebViewProps> = {
  allowsAirPlayForMediaPlayback: false,
  allowsInlineMediaPlayback: true,
  allowsPictureInPictureMediaPlayback: false,
  javaScriptCanOpenWindowsAutomatically: false,
  mediaPlaybackRequiresUserAction: true,
  injectedJavaScript: MEDIA_POLICY_SCRIPT,
  injectedJavaScriptBeforeContentLoaded: MEDIA_POLICY_SCRIPT,
  ...IOS_FRAME_INJECTION_PROPS
};
