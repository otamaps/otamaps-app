import FeatureSelectButton from "@/components/featureSelectButton";
import FindRoomView from "@/components/findRoomView";
import Spacer from "@/components/Spacer";
import { supabase } from "@/lib/supabase";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Dimensions, FlatList, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Room = {
  id: string;
  room_number?: number | null;
  title?: string | null;
  description?: string | null;
  seats?: number | null;
  type?: string | null;
  equipment?: any | null; // Or a more specific type if the structure of equipment is known
  wilma_id?: string | null;
  bookable?: string | null;
  image_url?: string | null;
  created_at?: string | null; // Or Date
  schedule?: string | null;
  geometry?: any | null; // Or a more specific type for GeoJSON, for example
  color: string;
};

const Find = () => {
  const [ selectedCont, setSelectedCont ] = useState("starts");
  const [ selectedDate, setSelectedDate ] = useState<Date>(new Date());
  const [ selectedDuration, setSelectedDuration ] = useState(15);
  const [ selectedPeople, setSelectedPeople ] = useState(2);
  const [ selectedFeatures, setSelectedFeatures ] = useState<string[]>([]);
  const [ showSearchBar, setShowSearchBar ] = useState(false); // New state for search bar visibility
  const [ searchQuery, setSearchQuery ] = useState(""); // New state for search query
  const [ searchResults, setSearchResults ] = useState<Room[]>([]); // New state for search results
  
  const handlePeopleDecrement = () => { if (selectedPeople > 1) setSelectedPeople(p => p - 1); };
  const handlePeopleIncrement = () => { if (selectedPeople < 30) setSelectedPeople(p => p + 1); };
  const handleDurationDecrement = () => { if (selectedDuration > 15) setSelectedDuration(p => p - 15); };
  const handleDurationIncrement = () => { if (selectedDuration < 90) setSelectedDuration(p => p + 15); };
  
  const handleFindFilters = async () => {
    // Implement search functionality here
    console.log("Search initiated with:", {
      date: selectedDate,
      duration: selectedDuration,
      people: selectedPeople,
      features: selectedFeatures,
    });

    let queryBuilder = supabase
      .from('rooms')
      .select('id, room_number, title, description, seats, type, equipment, wilma_id, bookable, image_url, created_at, schedule, color')
      .eq('bookable', 'true') 
      .gte('seats', selectedPeople);

    if (selectedFeatures.length > 0) {
      const featuresQueryObject = selectedFeatures.reduce((obj, feature) => {
        obj[feature] = feature; // Assumes features in DB are stored like {"featureName": "featureName"}
        return obj;
      }, {} as Record<string, boolean>);
      queryBuilder = queryBuilder.contains('equipment', featuresQueryObject);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error("Error fetching rooms:", error);
      setSearchResults([]); // Clear results on error or set to an empty array
      return;
    }

    setSearchResults(data || []); // Ensure data is not null

    console.log("Found rooms:", data);
    // Further processing of the found rooms
  }

  const handleClearFilters = () => {
    setSelectedCont("");
    setSelectedDate(new Date());
    setSelectedDuration(15);
    setSelectedPeople(2);
    setSelectedFeatures([]);
    setSearchResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Find a Room</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', }}>
          <Pressable 
            onPress={handleClearFilters}
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              { marginRight: 16, }
            ]}
          >
            <MaterialCommunityIcons name="filter-remove" size={28} color="white" />
          </Pressable>
          <Pressable 
            onPress={() => setShowSearchBar(true)} // Show search bar on press
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              { marginRight: 16, }
            ]}
          >
            <MaterialIcons name="search" size={28} color="white" />
          </Pressable>
        </View>
      </View>
      <ScrollView style={{ flex: 1, marginBottom: 48, }}>
      <View style={styles.searchOptionsContainer}>
      { 
        selectedCont === "datetime" ? (
          <Pressable style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.startsContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("");
            }}>
            <View style={styles.maxTopContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="calendar-month" size={28} color="black"  />
                <Text style={styles.minLeftText}>Date</Text>
              </View>
              <Text>{selectedDate.toDateString()}</Text>
            </View>
            <View style={styles.maxBottomContainer}>
              { Platform.OS === 'android' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%' }}>
                  <Pressable onPress={() => {
                  DateTimePickerAndroid.open({
                    value: selectedDate,
                    onChange: (event: DateTimePickerEvent, date?: Date) => {
                    if (date) setSelectedDate(date);
                    },
                    mode: 'date',
                    is24Hour: true,
                    minimumDate: new Date(Date.now()),
                    maximumDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                  });
                  }}>
                  <Text style={{ fontSize: 16, padding: 10 }}>{selectedDate.toLocaleDateString()}</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                  DateTimePickerAndroid.open({
                    value: selectedDate,
                    onChange: (event: DateTimePickerEvent, date?: Date) => {
                    if (date) setSelectedDate(date);
                    },
                    mode: 'time',
                    is24Hour: true,
                    minuteInterval: 15,
                  });
                  }}>
                  <Text style={{ fontSize: 16, padding: 10 }}>{selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={selectedDate}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    minuteInterval={15}
                    textColor="black"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={selectedDate}
                    mode="date"
                    is24Hour={true}
                    display="default"
                    textColor="black" 
                    maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)}
                    minimumDate={new Date(Date.now())}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />
                </View> 
              )}
            </View>
          </Pressable>
        ) : (
          <Pressable 
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.minContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("datetime");
            }}
          >
            <View style={styles.minLeft}>
              <MaterialIcons name="calendar-month" size={28} color="black"  />
              <Text style={styles.minLeftText}>Date</Text>
            </View>
            <View style={styles.minRight}>
              <Text>{selectedDate.toDateString()}</Text>
            </View>
          </Pressable>
        )
      }
      <Spacer width={99}/>
      { 
        selectedCont === "duration" ? (
          <Pressable style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.durationContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("");
            }}>
            <View style={styles.maxTopContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="access-time" size={28} color="black"  />
                <Text style={styles.minLeftText}>Duration</Text>
              </View>
              <Text>{selectedDuration} min</Text>
            </View>
            <View style={styles.maxBottomContainer}>
              <Pressable 
                onPress={handleDurationDecrement}
                style={{ 
                  padding: 16, 
                  backgroundColor: '#ebebeb', 
                  borderRadius: 16,
                  opacity: selectedDuration > 15 ? 1 : 0.5 
                }}
              >
                <MaterialIcons name="remove" size={28} color="black"  />
                </Pressable>
              <View>
                <TextInput style={{ fontSize: 28, fontWeight: 'semibold', paddingHorizontal: 24 }}>{selectedDuration} min</TextInput>
              </View>
              <Pressable 
                onPress={handleDurationIncrement}
                style={{ 
                  padding: 16, 
                  backgroundColor: '#ebebeb', 
                  borderRadius: 16,
                  opacity: selectedDuration >= 90 ? 0.5 : 1 
                }}
              >
                <MaterialIcons name="add" size={28} color="black" />
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <Pressable 
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.minContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("duration");
            }}
          >
            <View style={styles.minLeft}>
              <MaterialIcons name="access-time" size={28} color="black"  />
              <Text style={styles.minLeftText}>Duration</Text>
            </View>
            <View style={styles.minRight}>
              <Text>{selectedDuration} min</Text>
            </View>
          </Pressable>
        )
      }
      <Spacer width={99}/>
      { 
        selectedCont === "people" ? (
          <Pressable style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.peopleContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("");
            }}>
            <View style={styles.maxTopContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="people" size={28} color="black"  />
                <Text style={styles.minLeftText}>People</Text>
              </View>
              <Text>{selectedPeople}</Text>
            </View>
            <View style={styles.maxBottomContainer}>
              <Pressable 
                onPress={handlePeopleDecrement}
                style={{ 
                  padding: 16, 
                  backgroundColor: '#ebebeb', 
                  borderRadius: 16,
                  opacity: selectedPeople > 1 ? 1 : 0.5 
                }}
              >
                <MaterialIcons name="remove" size={28} color="black"  />
                </Pressable>
              <View>
                <TextInput style={{ fontSize: 28, fontWeight: 'semibold', paddingHorizontal: 24 }}>{selectedPeople}</TextInput>
              </View>
              <Pressable 
                onPress={handlePeopleIncrement}
                style={{ 
                  padding: 16, 
                  backgroundColor: '#ebebeb', 
                  borderRadius: 16,
                  opacity: selectedPeople >= 50 ? 0.5 : 1 
                }}
              >
                <MaterialIcons name="add" size={28} color="black" />
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <Pressable 
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.minContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("people");
            }}
          >
            <View style={styles.minLeft}>
              <MaterialIcons name="people" size={28} color="black"  />
              <Text style={styles.minLeftText}>People</Text>
            </View>
            <View style={styles.minRight}>
              {/* People Count */}
              <Text>{selectedPeople}</Text>
            </View>
          </Pressable>
        )
      }
      <Spacer width={99}/>
      { 
        selectedCont === "features" ? (
          <Pressable style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.featuresContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("");
            }}>
            <View style={styles.maxTopContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="fact-check" size={28} color="black"  />
                <Text style={styles.minLeftText}>Features</Text>
              </View>
              <Text>{selectedFeatures.length}</Text>
            </View>
            <View style={styles.featuresBottomContainer}>
              {/*<View style={styles.featuresRowContainer}>
                <FeatureSelectButton 
                  feature="classroom" 
                  onPress={() => {
                    if (selectedFeatures.includes("classroom")) {
                      setSelectedFeatures(selectedFeatures.filter(f => f !== "classroom"));
                    } else {
                      setSelectedFeatures([...selectedFeatures, "classroom"]);
                    }
                  }} 
                  icon="tv" 
                  title="Classroom"
                />
              </View>*/}
              <View style={styles.featuresRowContainer}>
                <FeatureSelectButton 
                  feature="display" 
                  onPress={() => {
                    if (selectedFeatures.includes("display")) {
                      setSelectedFeatures(selectedFeatures.filter(f => f !== "display"));
                    } else {
                      setSelectedFeatures([...selectedFeatures, "display"]);
                    }
                  }} 
                  icon="tv" 
                  title="Display"
                  selected={selectedFeatures.includes("display")}
                />
                <FeatureSelectButton 
                  feature="blackboard" 
                  onPress={() => {
                    if (selectedFeatures.includes("blackboard")) {
                      setSelectedFeatures(selectedFeatures.filter(f => f !== "blackboard"));
                    } else {
                      setSelectedFeatures([...selectedFeatures, "blackboard"]);
                    }
                  }} 
                  icon="blackboard" 
                  title="Board"
                  selected={selectedFeatures.includes("blackboard")}
                />
                <FeatureSelectButton 
                  feature="wifi" 
                  onPress={() => {
                    if (selectedFeatures.includes("wifi")) {
                      setSelectedFeatures(selectedFeatures.filter(f => f !== "wifi"));
                    } else {
                      setSelectedFeatures([...selectedFeatures, "wifi"]);
                    }
                  }} 
                  icon="tv" 
                  title="Display"
                  selected={selectedFeatures.includes("wifi")}
                />
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable 
            style={({ pressed }) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.minContainer
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelectedCont("features");
            }}
          >
            <View style={styles.minLeft}>
              <MaterialIcons name="fact-check" size={28} color="black"  />
              <Text style={styles.minLeftText}>Features</Text>
            </View>
            <View style={styles.minRight}>
              <Text>{selectedFeatures.length}</Text>
            </View>
          </Pressable>
        )
      }
      <Pressable style={({ pressed }) => [
        { opacity: pressed ? 0.7 : 1 },
        styles.findContainer
      ]} onPress={handleFindFilters}>
        <Text style={styles.findText}>Find</Text>
      </Pressable>
      </View>
      <Spacer width={100} top={0} />
      {searchResults.length > 0 ? (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ padding: 8, paddingBottom: 0, }}>
          <Text>Search Results:</Text>
        </View>     
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}

          renderItem={({ item }) => (
            <FindRoomView room={item}/>
          )}         
        /> 
      </View> 
      ) : (      
      <View>
        <View style={{ padding: 8, paddingBottom: 0, }}>  
          <Text>Favourites:</Text>
        </View>  
        <FlatList
          data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
          keyExtractor={(item) => item.toString()}

          renderItem={({ item }) => (
            <FindRoomView/>
          )}
        />
      </View> 
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default Find;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    width: '100%',
    height: 60,
    backgroundColor: '#4A89EE',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  topBarText: {
    fontSize: 22,
    fontWeight: 'semibold',
    color: '#fff',
    marginLeft: 16,
  },
  searchOptionsContainer: {
    backgroundColor: '#f8f8f8',
    padding: 8,
    paddingBottom: 0,
  },
  startsContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.16,
    flexDirection: 'column',
  },
  durationContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.16,
    flexDirection: 'column',
  },
  peopleContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.16,
    flexDirection: 'column',
  },
  featuresContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.16,
    flexDirection: 'column',
  },
  maxTopContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.06,
    alignItems: 'center',
    flexDirection: 'row',
    padding: 8,
    paddingBottom: 0,
    justifyContent: 'space-between',
  },
  maxBottomContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 8,
    paddingTop: 0,
  },
  minContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.06,
    marginVertical: 0,
    flexDirection: 'row',
    padding: 8,
  },
  minLeft: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  minLeftText: {
    marginLeft: 8,
    fontWeight: 'semibold',
    fontSize: 16,
  },
  minRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  findContainer: {
    height: SCREEN_HEIGHT * 0.06,
    backgroundColor: '#3478F5',
    marginVertical: 4,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    margin: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findText: {
    fontWeight: 'semibold',
    fontSize: 20,
    textAlign: 'center',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    color: '#fff',
  },
  featuresBottomContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    padding: 8,
    paddingTop: 0,
  },
  featuresRowContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.10,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 8,
    paddingTop: 0,
  }
});

/*

<DateTimePicker
                    testID="dateTimePicker"
                    value={selectedDate}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    minuteInterval={15}
                    textColor="black"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={selectedDate}
                    mode="date"
                    is24Hour={true}
                    display="default"
                    textColor="black"
                    maximumDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)}
                    minimumDate={new Date(Date.now())}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (date) setSelectedDate(date);
                    }}
                  />

*/