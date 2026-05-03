import { create } from "zustand";

export type TabStripPlacement = "top" | "left" | "right";
export type FavoritesBarVisibility = "always" | "never";

interface UIStore {
  addressBarFocusNonce: number;
  favoritesBarVisibility: FavoritesBarVisibility;
  focusAddressBar: () => void;
  setFavoritesBarVisibility: (visibility: FavoritesBarVisibility) => void;
  setTabStripPlacement: (placement: TabStripPlacement) => void;
  tabStripPlacement: TabStripPlacement;
}

export const useUIStore = create<UIStore>((set) => ({
  addressBarFocusNonce: 0,
  focusAddressBar: () =>
    set((state) => ({
      addressBarFocusNonce: state.addressBarFocusNonce + 1
    })),
  favoritesBarVisibility: "always",
  setFavoritesBarVisibility: (visibility) => set({ favoritesBarVisibility: visibility }),
  setTabStripPlacement: (placement) => set({ tabStripPlacement: placement }),
  tabStripPlacement: "top"
}));
