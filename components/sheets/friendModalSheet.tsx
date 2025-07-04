import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type FriendModalSheetRef = {
  present: () => void;
  snapToMid: () => void;
  snapToMax: () => void;
  close: () => void;
};

type FriendModalSheetProps = {
  children: React.ReactNode;
  onDismiss: () => void;
  initialSnap?: 'max' | 'mid' | 'min';
};

const maxHeight = SCREEN_HEIGHT * 0.95;
const midHeight = SCREEN_HEIGHT * 0.5;
const minHeight = SCREEN_HEIGHT * 0.3;

const FriendModalSheet = forwardRef<FriendModalSheetRef, FriendModalSheetProps>(({ 
  children, 
  onDismiss,
  initialSnap = 'mid',
}, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  
  const snapPoints = useMemo(
    () => [
      `${Math.round((minHeight / SCREEN_HEIGHT) * 100)}%`,
      `${Math.round((midHeight / SCREEN_HEIGHT) * 100)}%`,
      `${Math.round((maxHeight / SCREEN_HEIGHT) * 100)}%`,
    ],
    [minHeight, midHeight, maxHeight]
  );

  const initialIndex = useMemo(() => {
    switch (initialSnap) {
      case 'max': return 2;
      case 'mid': return 1;
      default: return 0;
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
  }));

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  return (
    <BottomSheetModal
			ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      onDismiss={onDismiss}
		>
			<BottomSheetScrollView 
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.content}>
					{children}
				</View>
			</BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  contentContainer: {
    flexGrow: 1,
    paddingTop: 5,
    padding: 20,
    paddingBottom: 40, // Extra padding at the bottom for better scrolling
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  handleIndicator: {
    backgroundColor: '#e0e0e0',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});

// Set display name for better debugging
FriendModalSheet.displayName = 'FriendModalSheet';

export default FriendModalSheet;
