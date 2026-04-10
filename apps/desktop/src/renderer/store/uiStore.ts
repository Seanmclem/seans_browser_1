import { create } from "zustand";

interface UIStore {
  addressBarFocusNonce: number;
  focusAddressBar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  addressBarFocusNonce: 0,
  focusAddressBar: () =>
    set((state) => ({
      addressBarFocusNonce: state.addressBarFocusNonce + 1
    }))
}));

