/**
 * A view's code focusing one of its own elements (a terminal taking focus
 * when its tab opens) can't pull focus out of the shell: the browser keeps
 * it out of a frame the user did not click into. When the view focuses
 * something while its frame lacks focus, this asks the shell to focus the
 * frame, then focuses that element again once it has.
 */

type Focusable = HTMLElement | SVGElement;
type FocusFn = (this: Focusable, options?: FocusOptions) => void;

let pending: { target: Focusable; options?: FocusOptions } | null = null;
let asked = false;
let originals: Map<object, FocusFn> | null = null;

function originalFocus(target: Focusable): FocusFn | undefined {
  if (!originals) return undefined;
  for (const [proto, fn] of originals) {
    if (Object.prototype.isPrototypeOf.call(proto, target)) return fn;
  }
  return undefined;
}

/** Starts watching focus calls. `ask` sends the request to the shell. */
export function watchFocusRequests(ask: () => void): void {
  if (originals) return;
  originals = new Map();
  const protos = [
    typeof HTMLElement !== "undefined" ? HTMLElement.prototype : null,
    typeof SVGElement !== "undefined" ? SVGElement.prototype : null,
  ];
  for (const proto of protos) {
    if (!proto) continue;
    const original = proto.focus as FocusFn;
    originals.set(proto, original);
    proto.focus = function focus(this: Focusable, options?: FocusOptions) {
      original.call(this, options);
      if (!this.isConnected || document.hasFocus()) return;
      pending = { target: this, options };
      // Several calls in one go (a component focusing then refocusing)
      // send one request.
      if (asked) return;
      asked = true;
      queueMicrotask(() => {
        asked = false;
        if (pending) ask();
      });
    };
  }
}

/** The shell focused this frame: focus what the view last asked for. */
export function focusGranted(): void {
  const entry = pending;
  pending = null;
  if (!entry || !entry.target.isConnected) return;
  if (document.activeElement === entry.target) return;
  originalFocus(entry.target)?.call(entry.target, entry.options);
}

/** Tests only. */
export function resetFrameFocusForTests(): void {
  if (originals) {
    for (const [proto, fn] of originals) {
      (proto as { focus: FocusFn }).focus = fn;
    }
  }
  originals = null;
  pending = null;
  asked = false;
}
