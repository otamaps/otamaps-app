/**
 * Used in:
 * - app/(tabs)/index.tsx - Main map screen
 */
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

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
    const [currentSnapIndex, setCurrentSnapIndex] = useState<number>(() => {
    switch (initialSnap) {
      case 'max':
        return 2;
      case 'mid':
        return 1;
      case 'min':
      default:
        return 0;
    }
  });

  const sheetRef = useRef<BottomSheet>(null);

    useImperativeHandle(ref, () => ({
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
    }), [currentSnapIndex]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={currentSnapIndex}
        snapPoints={[minHeight, midHeight, maxHeight]}
        enablePanDownToClose={false}
        style={styles.container}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        keyboardBehavior='extend'
        enableDynamicSizing={false}
        onChange={(index) => setCurrentSnapIndex(index)}
      >
        <BottomSheetView style={{ flex: 1, height: '100%' }}>
          {children({ currentSnapIndex })}
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
    paddingBottom: 5,
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
    backgroundColor: '#aaa',
    marginVertical: 2,
  },
});