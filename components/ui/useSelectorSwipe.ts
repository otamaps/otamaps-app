import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";

/** How far a swipe must travel, or how fast it must be flicked, to count. */
const MIN_DISTANCE = 60;
const MIN_VELOCITY = 500;

/**
 * Swiping a page sideways moves its selector to the next option, or the
 * previous: left for the next, as the content slides away to the left.
 * Stops at either end rather than wrapping round.
 *
 * Give the returned gesture to a `GestureDetector` around the page's scroll
 * view. That adds no view of its own — which matters, because the large
 * title and scroll-edge effect are tied to the scroll view being the
 * screen's first child (see `useNativeHeader`). A mostly-vertical drag fails
 * the gesture at once, so the list still scrolls.
 */
export function useSelectorSwipe<T extends string>(
  options: readonly (readonly [T, string])[],
  value: T,
  onChange: (value: T) => void,
) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((event, success) => {
          if (!success) return;
          const index = options.findIndex(([option]) => option === value);
          if (index < 0) return;
          const left = event.translationX < -MIN_DISTANCE || event.velocityX < -MIN_VELOCITY;
          const right = event.translationX > MIN_DISTANCE || event.velocityX > MIN_VELOCITY;
          const next = options[left ? index + 1 : right ? index - 1 : index];
          if (next && next[0] !== value) onChange(next[0]);
        }),
    [options, value, onChange],
  );
}
