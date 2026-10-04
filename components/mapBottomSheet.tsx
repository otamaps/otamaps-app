/**
 * Used in:
 * - app/(tabs)/index.tsx - Main map screen
 */
import { glassSheetChrome } from "@/components/sheets/sheetTheme";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Dimensions, StyleSheet, useColorScheme, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export type BottomSheetMethods = {
  /** Snap fully open */
  snapToMax: () => void;
  /** Snap to middle */
  snapToMid: () => void;
  /** Snap to collapsed */
  snapToMin: () => void;
  /** Get current snap point index */
  getCurrentSnapIndex: () => number;
};

export interface BottomSheetProps {
  /** Content to render inside the sheet */
  children: (props: { currentSnapIndex: number }) => ReactNode;
  /** Which position to start in (default “mid”) */
  initialSnap?: "max" | "mid" | "min";
  /** Heights (in px) for each snap point */
  maxHeight?: number;
  midHeight?: number;
  minHeight?: number;
  /**
   * Slide the sheet away entirely while something else — the canteen queue
   * sheet — is open on top of it, and put it back where it was afterwards.
   */
  hidden?: boolean;
  /**
   * The sheet's top edge, in screen coordinates, and its position between snap
   * points. Both update continuously while dragging — pass them in to let an
   * overlay outside the sheet track it.
   */
  animatedPosition?: SharedValue<number>;
  animatedIndex?: SharedValue<number>;
  /**
   * The scroll offset of the list inside the sheet. Giving it switches the
   * sheet's content from the library's drag to a plain swipe down: the list
   * scrolls freely at every height, and a downward swipe anywhere on the sheet,
   * made while the list is at the top, steps the sheet to the next smaller
   * snap point. The library's own content drag cannot do this — it locks the
   * list below the tallest snap point, and above it grabs upward drags that
   * the list needs. The sheet then grows only by dragging its handle.
   */
  swipeDownScrollOffset?: SharedValue<number>;
}

/** How far a finger moves before a touch is judged a swipe down, or not. */
const SWIPE_DECIDE_PX = 4;
/** How far a swipe down goes before the sheet steps down. */
const SWIPE_COLLAPSE_PX = 28;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * The sheet's default resting height. Exported so overlays that sit just above
 * the sheet can anchor to it instead of repeating the fraction.
 */
export const MAP_SHEET_MID_HEIGHT = SCREEN_HEIGHT * 0.35;

const MapBottomSheet = forwardRef<BottomSheetMethods, BottomSheetProps>(
  (
    {
      children,
      initialSnap = "mid",
      maxHeight = SCREEN_HEIGHT * 0.85,
      midHeight = MAP_SHEET_MID_HEIGHT,
      minHeight = SCREEN_HEIGHT * 0.2,
      hidden = false,
      animatedPosition,
      animatedIndex,
      swipeDownScrollOffset,
    },
    ref,
  ) => {
    const isDark = useColorScheme() === "dark";
    const sheetLook = glassSheetChrome(isDark);
    const [currentSnapIndex, setCurrentSnapIndex] = useState<number>(() => {
      switch (initialSnap) {
        case "max":
          return 2;
        case "mid":
          return 1;
        case "min":
        default:
          return 0;
      }
    });

    const sheetRef = useRef<BottomSheet>(null);

    // Where to put the sheet back once `hidden` clears. `currentSnapIndex`
    // itself goes to -1 while it is away, so the snap point the user had
    // chosen is remembered separately.
    const restoreIndexRef = useRef(currentSnapIndex);
    const wasHiddenRef = useRef(false);
    useEffect(() => {
      if (hidden) {
        wasHiddenRef.current = true;
        sheetRef.current?.close();
      } else if (wasHiddenRef.current) {
        wasHiddenRef.current = false;
        sheetRef.current?.snapToIndex(restoreIndexRef.current);
      }
    }, [hidden]);

    // Steps down one snap point: from tall to the middle, from the middle to
    // the small one.
    const collapseOneStep = () => {
      const index = restoreIndexRef.current;
      if (index > 0) sheetRef.current?.snapToIndex(index - 1);
    };
    const touchStart = useSharedValue({ x: 0, y: 0 });
    const collapsed = useSharedValue(false);
    const swipeDown = Gesture.Pan()
      // Activated by hand, so that until a downward swipe is recognised the
      // list's own scrolling is left entirely alone.
      .manualActivation(true)
      .onTouchesDown((event) => {
        const touch = event.allTouches[0];
        if (touch) {
          touchStart.value = { x: touch.absoluteX, y: touch.absoluteY };
        }
        collapsed.value = false;
      })
      .onTouchesMove((event, state) => {
        const touch = event.allTouches[0];
        if (!touch || !swipeDownScrollOffset || collapsed.value) return;
        const dx = Math.abs(touch.absoluteX - touchStart.value.x);
        const dy = touch.absoluteY - touchStart.value.y;
        // Decided within a few pixels, before the list's own scrolling gets
        // going: once the scroll view starts moving it takes the touch, and a
        // swipe down at the top of the list would only bounce it.
        if (dy < -SWIPE_DECIDE_PX || (dx > SWIPE_DECIDE_PX && dx > dy)) {
          // Up, or sideways: not ours.
          state.fail();
          return;
        }
        if (dy > SWIPE_DECIDE_PX) {
          // Down. Ours only if the list is already at the top; if not, this
          // drag is the list scrolling back up.
          if (swipeDownScrollOffset.value > 0) {
            state.fail();
            return;
          }
          state.activate();
          // Collapse as soon as it is clearly a swipe, rather than waiting
          // for the finger to lift.
          if (dy > SWIPE_COLLAPSE_PX) {
            collapsed.value = true;
            scheduleOnRN(collapseOneStep);
            state.end();
          }
        }
      })
      .onEnd((event) => {
        if (!collapsed.value && event.velocityY > 600) {
          collapsed.value = true;
          scheduleOnRN(collapseOneStep);
        }
      });

    useImperativeHandle(
      ref,
      () => ({
        snapToMax: () => {
          sheetRef.current?.snapToIndex(2);
          setCurrentSnapIndex(2);
        },
        snapToMid: () => {
          sheetRef.current?.snapToIndex(1);
          setCurrentSnapIndex(1);
        },
        snapToMin: () => {
          sheetRef.current?.snapToIndex(0);
          setCurrentSnapIndex(0);
        },
        getCurrentSnapIndex: () => currentSnapIndex,
      }),
      [currentSnapIndex],
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={currentSnapIndex}
        animatedPosition={animatedPosition}
        animatedIndex={animatedIndex}
        snapPoints={[minHeight, midHeight, maxHeight]}
        enablePanDownToClose={false}
        enableContentPanningGesture={
          !swipeDownScrollOffset && currentSnapIndex !== 2
        }
        enableHandlePanningGesture={true}
        style={[sheetLook.style, styles.container]}
        {...sheetLook.chrome}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        onChange={(index) => {
          if (index >= 0) restoreIndexRef.current = index;
          setCurrentSnapIndex(index);
        }}
      >
        <BottomSheetView style={{ flex: 1, height: "100%" }}>
          {swipeDownScrollOffset ? (
            <GestureDetector gesture={swipeDown}>
              <View collapsable={false} style={styles.fill}>
                {children({ currentSnapIndex })}
              </View>
            </GestureDetector>
          ) : (
            children({ currentSnapIndex })
          )}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

MapBottomSheet.displayName = "MapBottomSheet";

export default MapBottomSheet;

const styles = StyleSheet.create({
  fill: { flex: 1, height: "100%" },
  container: {
    zIndex: 3,
    paddingBottom: 5,
  },
});
