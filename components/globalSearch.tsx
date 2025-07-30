import { isFeatureEnabled } from "@/lib/featureFlagService";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
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

interface RoomModalRef {
  open: (roomId: string) => void;
  close: () => void;
}

interface GlobalSearchProps {
  roomModalRef: React.RefObject<RoomModalRef>;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface GlobalSearchMethods {
  focus: () => void;
}

const GlobalSearch = forwardRef(function GlobalSearch(
  props: GlobalSearchProps,
  ref: React.Ref<GlobalSearchMethods>
) {
  const isDark = useColorScheme() === "dark";
  const { roomModalRef } = props;
  const { top } = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    "Figtree-Regular": require("../assets/fonts/Figtree-Regular.ttf"),
    "Figtree-SemiBold": require("../assets/fonts/Figtree-SemiBold.ttf"),
    "Figtree-Bold": require("../assets/fonts/Figtree-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return <ActivityIndicator />;
  }

  const { query, refine } = useSearchBox({});
  const { hits } = useHits();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);
  const [floorsEnabled, setFloorsEnabled] = useState(false);

  // Check if floors feature is enabled
  useEffect(() => {
    const checkFloorsEnabled = async () => {
      const enabled = await isFeatureEnabled("floors_enabled");
      setFloorsEnabled(enabled);
    };
    checkFloorsEnabled();
  }, []);
  const searchResultsHeight = useRef(new Animated.Value(0)).current;
  const controlsWidth = useRef(new Animated.Value(52)).current;
  const searchMarginRight = useRef(new Animated.Value(12)).current;
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

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

  const handleFloorPress = (floor: number) => {
    setSelectedFloor(floor);
  };

  const handleSearchChange = (text: string) => {
    console.log("Search text changed:", text);
    setSearchQuery(text);
    console.log("Calling refine with:", text);
    refine(text);
    console.log("Refine called, current hits:", hits);
  };

  const handleFocus = () => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(controlsWidth, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(searchMarginRight, {
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
      Animated.parallel([
        Animated.timing(controlsWidth, {
          toValue: 52,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(searchMarginRight, {
          toValue: 12,
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

    // Open the room modal using the ref from props
    if (props.roomModalRef?.current) {
      props.roomModalRef.current.open(item.id);
    } else {
      console.warn("Room modal ref not found");
    }
  };

  const renderSearchResult = ({ item }: { item: any }) => {
    console.log("Rendering search result item:", item);

    // Extract the display values, falling back to empty strings if not found
    const roomNumber = item.room_number?.value || "";
    const description = item.description?.value || "";
    const type = item.type || "room"; // Default to 'room' if type not specified

    // all actual data is in _highlightResult
    const roomNumberHighlight = item._highlightResult.room_number?.value || "";
    const descriptionHighlight = item._highlightResult.description?.value || "";
    const typeHighlight = item._highlightResult.type?.value || "";
    const titleHighlight = item._highlightResult.title?.value || "";

    return (
      <Pressable
        style={[
          styles.resultItem,
          isDark && {
            backgroundColor: "#1e1e1e",
            borderBottomColor: "#303030",
          },
        ]}
        onPress={() => handleResultPress(item)}
      >
        <View style={styles.resultIcon}>
          {type === "room" ? (
            <MaterialIcons
              name="meeting-room"
              size={20}
              color={isDark ? "#e5e5e5" : "#666"}
            />
          ) : (
            <MaterialIcons
              name="person"
              size={20}
              color={isDark ? "#e5e5e5" : "#666"}
            />
          )}
          <Text
            style={[
              styles.resultText,
              { fontFamily: "Figtree-SemiBold", marginLeft: 8 },
              isDark && { color: "#fff" },
            ]}
            numberOfLines={1}
          >
            {roomNumberHighlight.replace(/<mark>|<\/mark>/g, "") ||
              "Unnamed Room"}
          </Text>
        </View>
        <View style={styles.resultContent}>
          <Text
            style={[
              styles.resultText,
              { fontFamily: "Figtree-Regular", marginTop: 4 },
              isDark && { color: "#d4d4d4" },
            ]}
            numberOfLines={1}
          >
            {titleHighlight.replace(/<mark>|<\/mark>/g, "")}
          </Text>
          {descriptionHighlight ? (
            <Text
              style={[
                styles.resultSubtext,
                { fontFamily: "Figtree-Regular", marginTop: 4 },
                isDark && { color: "#d4d4d4" },
              ]}
              numberOfLines={1}
            >
              {descriptionHighlight.replace(/<mark>|<\/mark>/g, "")}
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

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={[styles.container, { top: top }]}>
        <Animated.View
          style={[
            styles.searchContainer,
            {
              marginRight: searchMarginRight,
            },
            isDark && { backgroundColor: "#1e1e1e" },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={28}
            color={isDark ? "#737373" : "#666"}
          />
          <TextInput
            style={[
              styles.textInput,
              { fontFamily: "Figtree-Medium" },
              isDark && { color: "#fff" },
            ]}
            placeholder="Search for Anything"
            placeholderTextColor="#B5B5B5"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            ref={inputRef}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.centerContainer,
            {
              width: controlsWidth,
              opacity: isFocused ? 0 : 1,
            },
            isDark && { backgroundColor: "#1e1e1e" },
          ]}
          pointerEvents={isFocused ? "none" : "auto"}
        >
          <Pressable style={styles.button}>
            <MaterialIcons
              name="my-location"
              size={24}
              color={isDark ? "#f5f5f5" : "#000"}
            />
          </Pressable>
          {floorsEnabled && (
            <>
              <View style={styles.spacer} />
              <Pressable
                style={
                  selectedFloor === 4 ? styles.buttonSelected : styles.button
                }
                onPress={() => handleFloorPress(4)}
              >
                <Text style={{ fontFamily: "Figtree-SemiBold", fontSize: 16 }}>
                  4
                </Text>
              </Pressable>
              <View style={styles.spacer} />
              <Pressable
                style={
                  selectedFloor === 3 ? styles.buttonSelected : styles.button
                }
                onPress={() => handleFloorPress(3)}
              >
                <Text style={{ fontFamily: "Figtree-SemiBold", fontSize: 16 }}>
                  3
                </Text>
              </Pressable>
              <View style={styles.spacer} />
              <Pressable
                style={
                  selectedFloor === 2 ? styles.buttonSelected : styles.button
                }
                onPress={() => handleFloorPress(2)}
              >
                <Text style={{ fontFamily: "Figtree-SemiBold", fontSize: 16 }}>
                  2
                </Text>
              </Pressable>
              <View style={styles.spacer} />
              <Pressable
                style={
                  selectedFloor === 1 ? styles.buttonSelected : styles.button
                }
                onPress={() => handleFloorPress(1)}
              >
                <Text style={{ fontFamily: "Figtree-SemiBold", fontSize: 16 }}>
                  1
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>

        {(isFocused || searchQuery.length > 0) && (
          <Animated.View
            style={[
              styles.resultsContainer,
              {
                maxHeight: 300,
                opacity: searchResultsHeight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
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
            {hits.length > 0 ? (
              <FlatList
                data={hits}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.objectID}
                keyboardShouldPersistTaps="handled"
              />
            ) : searchQuery.length > 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No results found</Text>
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

export default React.memo(GlobalSearch);

const styles = StyleSheet.create({
  resultItem: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  resultIcon: {
    marginRight: 12,
    flexDirection: "row",
  },
  resultContent: {
    flex: 1,
  },
  resultText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Figtree-Regular",
  },
  resultSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    fontFamily: "Figtree-Regular",
  },
  noResults: {
    padding: 20,
    alignItems: "center",
  },
  noResultsText: {
    color: "#666",
    fontFamily: "Figtree-Regular",
  },
  container: {
    position: "absolute",
    width: "100%",
    paddingHorizontal: 10,
    zIndex: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    marginRight: 12,
    backgroundColor: "#fff",
    // height: 58,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    fontSize: 16,
    color: "#000",
    flex: 1,
    fontFamily: "Figtree-Regular",
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  resultsContainer: {
    position: "absolute",
    top: 60, // Position below the search bar
    left: 10,
    right: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: 300,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1000,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  resultText: {
    fontSize: 16,
    fontFamily: "Figtree-Regular",
    color: "#333",
  },
  noResults: {
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  noResultsText: {
    fontFamily: "Figtree-Regular",
    color: "#666",
    fontSize: 14,
  },
  centerContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  button: {
    padding: 8,
    paddingVertical: 12,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSelected: {
    padding: 8,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ddd",
    width: 52,
  },
  spacer: {
    height: 1,
    width: "80%",
    backgroundColor: "#ccc",
  },
});
