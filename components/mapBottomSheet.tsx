/**
 * Used in:
 * - app/(tabs)/index.tsx - Main map screen
 */
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { forwardRef, ReactNode, useImperativeHandle, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

export type BottomSheetMethods = {
  /** Snap fully open */
  snapToMax: () => void;
  /** Snap to middle */
  snapToMid: () => void;
  /** Snap to collapsed */
  snapToMin: () => void;
};

export interface BottomSheetProps {
  /** Content to render inside the sheet */
  children: ReactNode;
  /** Which position to start in (default “mid”) */
  initialSnap?: 'max' | 'mid' | 'min';
  /** Heights (in px) for each snap point */
  maxHeight?: number;
  midHeight?: number;
  minHeight?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MapBottomSheet = forwardRef<BottomSheetMethods, BottomSheetProps>(
  (
    {
      children,
      initialSnap = 'mid',
      maxHeight = SCREEN_HEIGHT * 0.85,
      midHeight = SCREEN_HEIGHT * 0.35,
      minHeight = SCREEN_HEIGHT * 0.2,
    },
    ref
  ) => {
    const initialIndex = useMemo(() => {
      switch (initialSnap) {
        case 'max':
          return 2;
        case 'mid':
          return 1;
        case 'min':
        default:
          return 0;
      }
    }, [initialSnap]);

    const sheetRef = useRef<BottomSheet>(null);

    useImperativeHandle(ref, () => ({
      snapToMax: () => sheetRef.current?.snapToIndex(2),
      snapToMid: () => sheetRef.current?.snapToIndex(1),
      snapToMin: () => sheetRef.current?.snapToIndex(0),
    }));

    return (
      <BottomSheet
        ref={sheetRef}
        index={initialIndex}
        snapPoints={[minHeight, midHeight, maxHeight]}
        enablePanDownToClose={false}
        style={styles.container}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        keyboardBehavior='extend'
        enableDynamicSizing={false}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);


export default MapBottomSheet;

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 3,
  },
  background: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CCC',
    marginVertical: 2,
  },
});