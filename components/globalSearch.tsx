import { useFonts } from "expo-font";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useHits, useSearchBox } from "react-instantsearch-core";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "@/components/map/GlassSurface";
import { nativeListColors } from "@/components/sheets/sheetTheme";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { useTheme } from "@/components/ui";
import { fonts } from "@/constants/typography";

interface RoomModalRef {
  open: (roomId: string) => void;
  close: () => void;
}

/** The search field's height; the map lines its recenter button up to it. */
export const SEARCH_HEIGHT = 48;
/** The accessory — the recenter button — and the 12pt gap before it. */
const ACCESSORY_SLOT = SEARCH_HEIGHT + 12;
/** The results panel's corners: rounder than a card, to sit under the capsule. */
const RESULTS_RADIUS = 22;

interface GlobalSearchProps {
  roomModalRef: React.RefObject<RoomModalRef>;
  onFocus?: () => void;
  onBlur?: () => void;
  selectedFloor?: number;
  onFloorChange?: (floor: number) => void;
  onRoomSelect?: (roomId: string) => void;
  /** A control beside the search field — the map's recenter button. */
  /**
   * A control beside the field — the map's recenter button — told whether
   * it is showing, so glass in it can hide itself natively (see
   * `GlassSurface`). It is hidden while the field is in use.
   */
  accessory?: (visible: boolean) => React.ReactNode;
}

export interface GlobalSearchMethods {
  focus: () => void;
}

const GlobalSearch = forwardRef(function GlobalSearch(
  props: GlobalSearchProps,
  ref: React.Ref<GlobalSearchMethods>
) {
  const isDark = useColorScheme() === "dark";
  const theme = useTheme();
  const list = nativeListColors(isDark);
  const {
    roomModalRef,
    selectedFloor: propSelectedFloor,
    onFloorChange,
  } = props;
  const { top } = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    "Figtree-Regular": require("../assets/fonts/Figtree-Regular.ttf"),
    "Figtree-Medium": require("../assets/fonts/Figtree-Medium.ttf"),
    "Figtree-SemiBold": require("../assets/fonts/Figtree-SemiBold.ttf"),
    "Figtree-Bold": require("../assets/fonts/Figtree-Bold.ttf"),
  });

  const { query, refine } = useSearchBox({});
  const { hits } = useHits();
  const [selectedFloor, setSelectedFloor] = useState(propSelectedFloor || 0);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);

  const searchResultsHeight = useRef(new Animated.Value(0)).current;
  // The accessory's slot — the button and the gap before it. It closes
  // while the field has focus, so the field widens into that space rather
  // than into the button.
  const controlsWidth = useRef(new Animated.Value(ACCESSORY_SLOT)).current;
  const [accessoryVisible, setAccessoryVisible] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  // Update local floor state when prop changes
  useEffect(() => {
    if (propSelectedFloor !== undefined) {
      setSelectedFloor(propSelectedFloor);
    }
  }, [propSelectedFloor]);

  // Animate search results container when hits or query changes
  useEffect(() => {
    console.log("Hits updated:", {
      hitsCount: hits.length,
      hits: hits,
      firstHit: hits[0]
        ? {
            ...hits[0],
            preview: {
              room_number: hits[0].room_number,
              description: hits[0].description,
              type: hits[0].type,
            },
          }
        : null,
    });

    // Animate the results container height based on whether we have hits or not
    if ((hits.length > 0 || searchQuery.length > 0) && isFocused) {
      Animated.timing(searchResultsHeight, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(searchResultsHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [hits, searchQuery, isFocused]);

  // Debug: Log initial props and state
  useEffect(() => {
    console.log("Search component mounted with:", {
      props,
      initialQuery: query,
      initialHits: hits,
    });
  }, []);

  const handleSearchChange = (text: string) => {
    console.log("Search text changed:", text);
    setSearchQuery(text);
    console.log("Calling refine with:", text);
    refine(text);
    console.log("Refine called, current hits:", hits);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setAccessoryVisible(false);
    Animated.parallel([
      Animated.timing(controlsWidth, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    if (props.onFocus) {
      props.onFocus();
    }
  };

  const handleBlur = () => {
    if (searchQuery.length === 0) {
      setAccessoryVisible(true);
      Animated.parallel([
        Animated.timing(controlsWidth, {
          toValue: ACCESSORY_SLOT,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(searchResultsHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsFocused(false);
          props.onBlur?.();
        }
      });
    } else {
      props.onBlur?.();
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };
  const handleResultPress = (item: any) => {
    console.log("Selected room:", item);
    // Close the search
    setSearchQuery("");
    handleBlur();
    dismissKeyboard();

    // Switch to the room's floor if available and different from current
    if (
      item.floor !== undefined &&
      item.floor !== selectedFloor &&
      onFloorChange
    ) {
      console.log(
        `🏢 Search: Switching from floor ${selectedFloor} to floor ${
          item.floor
        } for room ${
          item.room_number?.value ||
          item._highlightResult.room_number?.value ||
          "unknown"
        }`
      );
      onFloorChange(item.floor);
    }

    // Call the room select handler first (this will handle floor switching and camera focusing)
    if (props.onRoomSelect) {
      props.onRoomSelect(item.id);
    } else {
      // Fallback: Open the room modal using the ref from props
      if (props.roomModalRef?.current) {
        props.roomModalRef.current.open(item.id);
      } else {
        console.warn("Room modal ref not found");
      }
    }
  };

  // Algolia wraps matches in <mark>; the rows show plain text.
  const plain = (value?: string) => (value ?? "").replace(/<\/?mark>/g, "");

  // One result as a native list row, matching the friends list in the
  // sheet: the room number as the title, and its name and description as
  // one secondary line beneath.
  const renderSearchResult = ({ item }: { item: any }) => {
    const highlight = item._highlightResult ?? {};
    const title = plain(highlight.room_number?.value) || item.title || "";
    const subtitle = [plain(highlight.title?.value), plain(highlight.description?.value)]
      .filter((part) => part && part !== title)
      .join(" · ");

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle].filter(Boolean).join(", ")}
        style={({ pressed }) => [
          styles.resultRow,
          pressed && { backgroundColor: list.highlight },
        ]}
        onPress={() => handleResultPress(item)}
      >
        <View style={styles.resultText}>
          <Text style={[styles.resultTitle, { color: list.label }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.resultSubtitle, { color: list.secondaryLabel }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setTimeout(() => {
          if (isFocused) {
            handleBlur();
          }
        }, 10);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [isFocused, searchQuery]);

  if (!fontsLoaded) {
    return <ActivityIndicator />;
  }

  return (
    <>
      {/* Tapping away from the field dismisses the keyboard. This only exists
          while the field has focus — as a permanent wrapper around the
          controls it swallowed every map gesture inside the row's bounding
          box, which is as tall as the whole floor column. */}
      {isFocused && (
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
          <View style={styles.keyboardDismissArea} />
        </TouchableWithoutFeedback>
      )}
      {/* box-none: the row is a full-width transparent band, so it must never
          be a touch target itself — only the field and the floor buttons
          inside it are. Everything else here is map. */}
      <View
        style={[styles.container, { top: top }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={styles.searchSlot}
        >
          {/* A glass capsule in the system font, as the search field in
              Apple Maps is, with the native clear button while there is
              something to clear. */}
          <GlassSurface radius={SEARCH_HEIGHT / 2} style={styles.searchField}>
            <PlatformSymbol
              ios="magnifyingglass"
              android="search"
              size={17}
              weight="medium"
              tintColor={theme.textMuted}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Hae huoneita"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.accent}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              returnKeyType="search"
              clearButtonMode="never"
              ref={inputRef}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => handleSearchChange("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Tyhjennä haku"
              >
                <PlatformSymbol
                  ios="xmark.circle.fill"
                  android="cancel"
                  size={17}
                  tintColor={theme.textFaint}
                />
              </Pressable>
            )}
          </GlassSurface>
        </Animated.View>

        {props.accessory ? (
          <Animated.View
            style={[
              styles.accessorySlot,
              // No opacity here: fading an ancestor of glass stops it drawing.
              { width: controlsWidth },
            ]}
          >
            {/* Slides right by as much as the slot has narrowed, so it
                always sits a gap clear of the widening field and needs no
                clipping — which would cut off the glass, since interactive
                Liquid Glass swells past its bounds under a touch. */}
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: controlsWidth.interpolate({
                      inputRange: [0, ACCESSORY_SLOT],
                      outputRange: [ACCESSORY_SLOT, 0],
                    }),
                  },
                ],
              }}
            >
              {props.accessory(accessoryVisible)}
            </Animated.View>
          </Animated.View>
        ) : null}

        {(isFocused || searchQuery.length > 0) && (
          <Animated.View
            style={[
              styles.resultsSlot,
              // A slide only — fading an ancestor of glass stops it drawing.
              {
                transform: [
                  {
                    translateY: searchResultsHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* The same glass as the field above it, so the two read as
                one control rather than a field and a pop-up. */}
            <GlassSurface radius={RESULTS_RADIUS} style={styles.resultsPanel}>
              {hits.length > 0 && searchQuery.length > 0 ? (
                <FlatList
                  data={hits}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.objectID}
                  keyboardShouldPersistTaps="handled"
                  ItemSeparatorComponent={() => (
                    <View
                      style={[
                        styles.resultSeparator,
                        { backgroundColor: list.separator },
                      ]}
                    />
                  )}
                />
              ) : (
                // Plain small text, centred — a note about the field, not a
                // second field: no glyph, and shorter than the capsule.
                <View style={styles.hint}>
                  <Text
                    style={[styles.hintText, { color: list.secondaryLabel }]}
                    numberOfLines={2}
                  >
                    {searchQuery
                      ? `Ei tuloksia haulle ”${searchQuery}”`
                      : "Hae tilaa numerolla tai nimellä"}
                  </Text>
                </View>
              )}
            </GlassSurface>
          </Animated.View>
        )}
      </View>
    </>
  );
});

export default React.memo(GlobalSearch);

const styles = StyleSheet.create({
  // Results as a native list, sized as the friends list rows are.
  resultsSlot: {
    position: "absolute",
    top: SEARCH_HEIGHT + 8,
    left: 10,
    right: 10,
  },
  resultsPanel: { maxHeight: 320, overflow: "hidden" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resultText: { flex: 1 },
  // Type set through `fonts`, so it follows `IOS_TYPEFACE` with the rest of the app.
  resultTitle: { ...fonts.regular, fontSize: 17 },
  resultSubtitle: { ...fonts.regular, fontSize: 14, marginTop: 2 },
  resultSeparator: {
    height: StyleSheet.hairlineWidth,
    // Under the text, as UIKit insets a separator to the content.
    marginLeft: 14,
  },
  hint: { paddingHorizontal: 16, paddingVertical: 10 },
  hintText: { ...fonts.regular, fontSize: 13, textAlign: "center" },
  keyboardDismissArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    position: "absolute",
    width: "100%",
    paddingHorizontal: 10,
    zIndex: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // Changed from "center" to "flex-start" to align at top
  },
  searchSlot: { flex: 1 },
  // Pinned to the right edge; never clipped (see the slide in the JSX).
  accessorySlot: { alignItems: "flex-end" },
  searchField: {
    height: SEARCH_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Type set through `fonts`, so it follows `IOS_TYPEFACE` with the rest of the app.
  textInput: {
    ...fonts.regular,
    flex: 1,
    fontSize: 17,
    paddingVertical: 0,
  },
});
