"use client";

import ShellModuleDrawer from "./ShellModuleDrawer";
import { useShellInteraction } from "./ShellInteractionProvider";

export default function ShellOverlayController() {
  const { panel, closePanel, restorePanelFocus, getPanelScrollPosition } = useShellInteraction();
  return <ShellModuleDrawer panel={panel} onClose={closePanel} onRestoreFocus={restorePanelFocus} getScrollPosition={getPanelScrollPosition} />;
}
