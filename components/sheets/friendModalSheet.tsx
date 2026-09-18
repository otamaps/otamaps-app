import {
  sheetChrome,
  sheetPalette,
  sheetShadow,
} from "@/components/sheets/sheetTheme";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, useColorScheme, View } from "react-native";

export type FriendModalSheetRef = {
  present: () => void;
  snapToMid: () => void;
  snapToMax: () => void;
  close: () => void;
  /** -1 while dismissed, otherwise the current snap index (0 = min, 1 = mid, 2 = max). */
  getCurrentSnapIndex: () => number;
};

type FriendModalSheetProps = {
  children: React.ReactNode;
  onDismiss: () => void;
  initialSnap?: "max" | "mid" | "min";
};

const FriendModalSheet = forwardRef<FriendModalSheetRef, FriendModalSheetProps>(
  ({ children, onDismiss, initialSnap = "mid" }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [currentSnapIndex, setCurrentSnapIndex] = useState(-1);

    const isDark = useColorScheme() === "dark";
    const { surface } = sheetPalette(isDark);

    const snapPoints = useMemo(() => ["42%", "68%", "94%"], []);

    const initialIndex = useMemo(() => {
      switch (initialSnap) {
        case "max":
          return 2;
        case "mid":
          return 1;
        default:
          return 0;
      }
    }, [initialSnap]);

    const handlePresent = useCallback(() => {
      sheetRef.current?.present();
      sheetRef.current?.snapToIndex(initialIndex);
    }, [initialIndex]);

    useImperativeHandle(ref, () => ({
      present: handlePresent,
      snapToMid: () => sheetRef.current?.snapToIndex(1),
      snapToMax: () => sheetRef.current?.snapToIndex(2),
      close: () => sheetRef.current?.close(),
      getCurrentSnapIndex: () => currentSnapIndex,
    }));

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        onDismiss={() => {
          setCurrentSnapIndex(-1);
          onDismiss();
        }}
        onChange={setCurrentSnapIndex}
        style={sheetShadow}
        {...sheetChrome(isDark)}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.contentContainer,
            { backgroundColor: surface },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { backgroundColor: surface }]}>
            {children}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    width: "100%",
  },
});

// Set display name for better debugging
FriendModalSheet.displayName = "FriendModalSheet";

export default FriendModalSheet;
