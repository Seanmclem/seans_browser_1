import { create } from "zustand";

export type TabStripPlacement = "top" | "left" | "right";

interface UIStore {
  addressBarFocusNonce: number;
  focusAddressBar: () => void;
  setTabStripPlacement: (placement: TabStripPlacement) => void;
  tabStripPlacement: TabStripPlacement;
}

export const useUIStore = create<UIStore>((set) => ({
  addressBarFocusNonce: 0,
  focusAddressBar: () =>
    set((state) => ({
      addressBarFocusNonce: state.addressBarFocusNonce + 1
    })),
  setTabStripPlacement: (placement) => set({ tabStripPlacement: placement }),
  tabStripPlacement: "top"
}));
