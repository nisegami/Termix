import { afterEach, describe, expect, it, vi } from "vitest";
import {
  focusGranted,
  resetFrameFocusForTests,
  watchFocusRequests,
} from "@/plugin-frame/frame-focus";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  resetFrameFocusForTests();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("frame focus requests", () => {
  it("asks the shell once when the frame lacks focus, then refocuses", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const ask = vi.fn();
    watchFocusRequests(ask);
    const first = document.createElement("textarea");
    const second = document.createElement("textarea");
    document.body.append(first, second);
    first.focus();
    second.focus();
    await flush();
    expect(ask).toHaveBeenCalledTimes(1);

    first.focus();
    expect(document.activeElement).toBe(first);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    // The last element asked for wins.
    focusGranted();
    expect(document.activeElement).toBe(first);
  });

  it("asks nothing while the frame has focus", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const ask = vi.fn();
    watchFocusRequests(ask);
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it("refocuses the asked element when something else took it meanwhile", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    watchFocusRequests(() => {});
    const wanted = document.createElement("textarea");
    const other = document.createElement("button");
    document.body.append(wanted, other);
    wanted.focus();
    vi.mocked(document.hasFocus).mockReturnValue(true);
    other.focus();
    focusGranted();
    expect(document.activeElement).toBe(wanted);
  });
});
