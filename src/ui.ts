import { PARTS, PARTS_BY_QUEUE, type PartDef } from "./parts-data.ts";

export interface UIHandles {
  toggleButton: HTMLButtonElement;
  showPanel: (part: PartDef) => void;
  hidePanel: () => void;
  isPanelOpen: () => boolean;
  setHoverLabel: (text: string | null, x: number, y: number) => void;
  setExploded: (exploded: boolean) => void;
  setQueueLabelsVisible: (visible: boolean) => void;
  positionQueueLabel: (id: string, x: number, y: number) => void;
  getPanelOverlayWidth: () => number;
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
  const queueLabels = el<HTMLElement>("queue-labels");
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

  // One label per part, positioned every frame by main.ts (world→screen
  // projection of each queue slot) rather than laid out in CSS — the queue's
  // X positions are computed in world space (config.ts QUEUE.spacing), not
  // pixels.
  const queueLabelEls = new Map<string, HTMLElement>();
  for (const part of PARTS_BY_QUEUE) {
    const span = document.createElement("span");
    span.className = "queue-label";
    span.textContent = part.queueLabel;
    queueLabels.append(span);
    queueLabelEls.set(part.id, span);
  }

  function showPanel(part: PartDef) {
    const index = PARTS_BY_QUEUE.findIndex((p) => p.id === part.id);
    panelIndex.textContent = `${String(index + 1).padStart(2, "0")} / ${String(PARTS_BY_QUEUE.length).padStart(2, "0")}`;
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
    setQueueLabelsVisible(visible) {
      queueLabels.classList.toggle("visible", visible);
    },
    positionQueueLabel(id, x, y) {
      const span = queueLabelEls.get(id);
      if (!span) return;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
    },
    getPanelOverlayWidth() {
      // The panel's CSS width (and thus getBoundingClientRect().width) is
      // unaffected by its open/closed transform, so this reads correctly
      // even while the panel is currently slid off-screen. On the mobile
      // breakpoint the panel becomes a full-width bottom drawer rather than
      // a right-side overlay — detect that from measured layout (narrower
      // than the window = right overlay) rather than duplicating the CSS
      // breakpoint value here.
      const rect = panel.getBoundingClientRect();
      return rect.width < window.innerWidth - 1 ? rect.width : 0;
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
