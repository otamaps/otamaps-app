import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GlobalSearch = () => {
  const { top } = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    'Figtree-Regular': require('../assets/fonts/Figtree-Regular.ttf'), 
    'Figtree-SemiBold': require('../assets/fonts/Figtree-SemiBold.ttf'),
    'Figtree-Bold': require('../assets/fonts/Figtree-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <ActivityIndicator />;
  }

  const [selectedFloor, setSelectedFloor] = useState(1);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const controlsWidth = useRef(new Animated.Value(52)).current;
  const searchMarginRight = useRef(new Animated.Value(12)).current;
  const searchResultsHeight = useRef(new Animated.Value(0)).current;

  const handleFloorPress = (floor: number) => {
    setSelectedFloor(floor);
  };

  // Mock search function - replace with your actual search logic
  const performSearch = (query: string) => {
    if (query.length > 0) {
      // Simulate search results
      const mockResults = [
        { id: '1', name: 'Search Result 1' },
        { id: '2', name: 'Search Result 2' },
        { id: '3', name: 'Search Result 3' },
      ];
      setSearchResults(mockResults);
      Animated.timing(searchResultsHeight, {
        toValue: 150, // Adjust height based on number of results
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      setSearchResults([]);
      Animated.timing(searchResultsHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    performSearch(text);
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
      })
    ]).start();
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
        })
      ]).start(({ finished }) => {
        if (finished) {
          setIsFocused(false);
          setSearchResults([]);
        }
      });
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };
  const renderSearchResult = ({ item }: { item: any }) => (
    <Pressable 
      style={styles.resultItem}
      onPress={() => {
        setSearchQuery(item.name);
        Keyboard.dismiss();
      }}
    >
      <Text style={styles.resultText}>{item.name}</Text>
    </Pressable>
  );

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setTimeout(() => {
        if (isFocused) {
          handleBlur();
        }
      }, 10);
    });

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
            }
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={28} color="#000" />
          <TextInput
            style={[styles.textInput, { fontFamily: 'Figtree-Bold' }]} 
            placeholder="Search for Anything" 
            placeholderTextColor="#B5B5B5"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </Animated.View>
        <Animated.View 
          style={[
            styles.centerContainer, 
            { 
              width: controlsWidth,
              opacity: isFocused ? 0 : 1,
            }
          ]}
          pointerEvents={isFocused ? 'none' : 'auto'}
        >
          <Pressable style={styles.button}>
            <MaterialIcons name="my-location" size={26} color="#000" />
          </Pressable>
          <View style={styles.spacer}/>
          <Pressable style={selectedFloor === 4 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(4)}>
            <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>4</Text>
          </Pressable>
          <View style={styles.spacer}/>
          <Pressable style={selectedFloor === 3 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(3)}>
            <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>3</Text>
          </Pressable>
          <View style={styles.spacer}/>
          <Pressable style={selectedFloor === 2 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(2)}>
            <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>2</Text>
          </Pressable>
          <View style={styles.spacer}/>
          <Pressable style={selectedFloor === 1 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(1)}>
            <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>1</Text>
          </Pressable>
        </Animated.View>
        
        {(isFocused || searchQuery.length > 0) && (
          <Animated.View 
            style={[
              styles.resultsContainer,
              { 
                height: searchResultsHeight,
                opacity: searchResultsHeight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              }
            ]}
          >
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
              />
            ) : searchQuery.length > 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No results found</Text>
              </View>
            ) : null}
          </Animated.View>
        )}s
      </View>
    </TouchableWithoutFeedback>
  );
};

export default GlobalSearch;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 10,
    zIndex: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  searchContainer: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#fff',
    height: 58,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    fontSize: 16,
    color: '#000',
    flex: 1,
    fontFamily: 'Figtree-Regular',
    paddingVertical: 0,
  },
  resultsContainer: {
    position: 'absolute',
    top: 58,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultText: {
    fontSize: 16,
    fontFamily: 'Figtree-Regular',
    color: '#333',
  },
  noResults: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontFamily: 'Figtree-Regular',
    color: '#666',
    fontSize: 14,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  button: {
    padding: 8,
    paddingVertical: 12,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSelected: {
    padding: 8,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#ddd',
    width: 52,
  },
  spacer: {
    height: 1,
    width: "80%",
    backgroundColor: '#ccc',
  },
});
