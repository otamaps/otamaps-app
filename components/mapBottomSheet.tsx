/**
 * Used in:
 * - app/(tabs)/index.tsx - Main map screen
 */
import { sheetChrome, sheetShadow } from "@/components/sheets/sheetTheme";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Dimensions, StyleSheet, useColorScheme } from "react-native";

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
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const MapBottomSheet = forwardRef<BottomSheetMethods, BottomSheetProps>(
  (
    {
      children,
      initialSnap = "mid",
      maxHeight = SCREEN_HEIGHT * 0.85,
      midHeight = SCREEN_HEIGHT * 0.35,
      minHeight = SCREEN_HEIGHT * 0.2,
      hidden = false,
    },
    ref
  ) => {
    const isDark = useColorScheme() === "dark";
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
      [currentSnapIndex]
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={currentSnapIndex}
        snapPoints={[minHeight, midHeight, maxHeight]}
        enablePanDownToClose={false}
        enableContentPanningGesture={currentSnapIndex !== 2}
        enableHandlePanningGesture={true}
        style={[sheetShadow, styles.container]}
        {...sheetChrome(isDark)}
        keyboardBehavior="extend"
        enableDynamicSizing={false}
        onChange={(index) => {
          if (index >= 0) restoreIndexRef.current = index;
          setCurrentSnapIndex(index);
        }}
      >
        <BottomSheetView style={{ flex: 1, height: "100%" }}>
          {children({ currentSnapIndex })}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

MapBottomSheet.displayName = "MapBottomSheet";

export default MapBottomSheet;

const styles = StyleSheet.create({
  container: {
    zIndex: 3,
    paddingBottom: 5,
  },
});
