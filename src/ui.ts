import { PARTS, type PartDef } from "./parts-data.ts";

export interface UIHandles {
  toggleButton: HTMLButtonElement;
  showPanel: (part: PartDef) => void;
  hidePanel: () => void;
  isPanelOpen: () => boolean;
  setHoverLabel: (text: string | null, x: number, y: number) => void;
  setExploded: (exploded: boolean) => void;
  onExplodeToggle: (handler: () => void) => void;
  onPartChosen: (handler: (part: PartDef) => void) => void;
  onPanelClose: (handler: () => void) => void;
  onPanelStep: (handler: (direction: 1 | -1) => void) => void;
  onEscape: (handler: () => void) => void;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

export function setupUI(): UIHandles {
  const toggleButton = el<HTMLButtonElement>("explode-toggle");
  const kbdParts = el<HTMLElement>("kbd-parts");
  const panel = el<HTMLElement>("detail-panel");
  const panelClose = el<HTMLButtonElement>("panel-close");
  const panelPrev = el<HTMLButtonElement>("panel-prev");
  const panelNext = el<HTMLButtonElement>("panel-next");
  const hoverLabel = el<HTMLElement>("hover-label");
  const emptyState = el<HTMLElement>("empty-state");
  const panelIndex = el<HTMLElement>("panel-index");
  const panelName = el<HTMLElement>("panel-name");
  const panelAbbr = el<HTMLElement>("panel-abbr");
  const panelDef = el<HTMLElement>("panel-def");
  const panelExplain = el<HTMLElement>("panel-explain");
  const panelResponsibility = el<HTMLElement>("panel-responsibility");
  const panelImportance = el<HTMLElement>("panel-importance");
  const panelSpec = el<HTMLElement>("panel-spec");

  let lastFocused: HTMLElement | null = null;
  let panelOpen = false;
  const partChosenHandlers: Array<(part: PartDef) => void> = [];

  for (const part of PARTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Select: ${part.name}`;
    btn.addEventListener("click", () => partChosenHandlers.forEach((h) => h(part)));
    kbdParts.append(btn);
  }

  function showPanel(part: PartDef) {
    const index = PARTS.findIndex((p) => p.id === part.id);
    panelIndex.textContent = `${String(index + 1).padStart(2, "0")} / ${String(PARTS.length).padStart(2, "0")}`;
    panelName.textContent = part.name;
    panelAbbr.textContent = part.abbr;
    panelDef.textContent = part.definition;
    panelExplain.textContent = part.explanation;
    panelResponsibility.textContent = part.responsibility;
    panelImportance.textContent = part.importance;
    panelSpec.textContent = part.specFact;

    if (!panelOpen) {
      lastFocused = document.activeElement as HTMLElement | null;
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      panel.inert = false;
      panelOpen = true;
      panelClose.focus();
    }
  }

  function hidePanel() {
    if (!panelOpen) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    // aria-hidden alone doesn't stop the panel's buttons from being tabbed
    // into while it's slid off-screen — `inert` removes them from the tab
    // order and from being findable by assistive tech until reopened.
    panel.inert = true;
    panelOpen = false;
    lastFocused?.focus();
  }

  panelClose.addEventListener("click", () => hidePanel());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panelOpen) hidePanel();
  });

  return {
    toggleButton,
    showPanel,
    hidePanel,
    isPanelOpen: () => panelOpen,
    setHoverLabel(text, x, y) {
      if (text) {
        hoverLabel.textContent = text;
        hoverLabel.style.left = `${x}px`;
        hoverLabel.style.top = `${y}px`;
        hoverLabel.classList.add("visible");
      } else {
        hoverLabel.classList.remove("visible");
      }
    },
    setExploded(exploded) {
      toggleButton.setAttribute("aria-pressed", String(exploded));
      toggleButton.textContent = exploded ? "Reassemble" : "Explore Inside";
      emptyState.classList.toggle("hidden", exploded);
    },
    onExplodeToggle(handler) {
      toggleButton.addEventListener("click", handler);
    },
    onPartChosen(handler) {
      partChosenHandlers.push(handler);
    },
    onPanelClose(handler) {
      panelClose.addEventListener("click", handler);
    },
    onPanelStep(handler) {
      panelPrev.addEventListener("click", () => handler(-1));
      panelNext.addEventListener("click", () => handler(1));
    },
    onEscape(handler) {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") handler();
      });
    },
  };
}
