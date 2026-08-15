export type SceneState = "assembled" | "opening" | "exploded" | "focusing" | "detail" | "reassembling";

type Listener = (state: SceneState, previous: SceneState) => void;

// Deliberately just an explicit set of named states plus one transition
// function, rather than a full FSM library — with six states and no
// concurrent transitions in flight, a table of allowed edges buys more
// ceremony than safety here.
const TRANSITIONS: Record<SceneState, SceneState[]> = {
  assembled: ["opening"],
  opening: ["exploded"],
  exploded: ["focusing", "reassembling"],
  focusing: ["detail", "exploded", "reassembling"],
  detail: ["focusing", "exploded", "reassembling"],
  reassembling: ["assembled"],
};

export class SceneStateMachine {
  private current: SceneState = "assembled";
  private listeners: Listener[] = [];

  get state(): SceneState {
    return this.current;
  }

  is(...states: SceneState[]): boolean {
    return states.includes(this.current);
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener);
  }

  transition(next: SceneState): boolean {
    if (!TRANSITIONS[this.current].includes(next)) {
      console.warn(`[state] ignored illegal transition ${this.current} -> ${next}`);
      return false;
    }
    const previous = this.current;
    this.current = next;
    for (const listener of this.listeners) listener(next, previous);
    return true;
  }
}
