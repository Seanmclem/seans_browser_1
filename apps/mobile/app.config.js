export default {
  expo: {
    name: "Sean's Browser",
    slug: "seans-browser",
    scheme: "seansbrowser",
    version: "0.1.0",
    orientation: "default",
    userInterfaceStyle: "dark",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#071123",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.seanclements.browser",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.seanclements.browser",
    },
    plugins: ["expo-dev-client"],
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
    owner: "seanmclem",
  },
};
