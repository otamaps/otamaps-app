import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from 'react-native-gesture-handler';

// Types
export type POIModalMethods = {
  snapToMax: () => void;
  snapToMid: () => void;
  close: () => void;
  present: () => void;
};

interface POI {
  id: string;
  lat: number;
  lon: number;
  title: string;
  icon_url: string;
  address?: string;
  type: string;
  description?: string;
}

type WantToVisit = {
  uid: string;
  thingy_id: string[];
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ensure a want_to_visit row exists for this user
async function ensureWantToVisitRow(uid: string): Promise<WantToVisit> {
  const { data: profile, error: fetchErr } = await supabase
    .from<WantToVisit>('want_to_visit')
    .select('thingy_id')
    .eq('uid', uid)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  if (!profile) {
    const { data, error: insertErr } = await supabase
      .from<WantToVisit>('want_to_visit')
      .insert({ uid, thingy_id: [] })
      .single();
    if (insertErr) throw insertErr;
    return data;
  }

  return profile;
}

const openMapWithDirections = (lat: number, lon: number) => {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

  Linking.openURL(url).catch(err => console.error('Error launching map:', err));
};

const POIModal = forwardRef<POIModalMethods, { initialSnap?: 'max' | 'mid' | 'min'; maxHeight?: number; midHeight?: number; minHeight?: number; selectedPoiData?: POI; messages?: any[] }>(
  (
    {
      initialSnap = 'mid',
      maxHeight = SCREEN_HEIGHT * 0.95,
      midHeight = SCREEN_HEIGHT * 0.5,
      minHeight = SCREEN_HEIGHT * 0.3,
      selectedPoiData,
      messages = [],
    },
    ref
  ) => {
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

    // Chat user names
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [comment, setComment] = useState('');
    const [wantToVisit, setWantToVisit] = useState(false);

    // Load users & want-to-visit status
    useEffect(() => {
      async function fetchMeta() {
        // fetch chat users
        const userIds = Array.from(
          new Set(messages.map(m => m.user_id).filter(id => !!id))
        );
        if (userIds.length) {
          const { data, error } = await supabase
            .from('users')
            .select('id, name')
            .in('id', userIds);
          if (!error && data) {
            setUserMap(Object.fromEntries(data.map(u => [u.id, u.name])));
          }
        }

        // fetch want-to-visit flag
        if (selectedPoiData?.id) {
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
              const profile = await ensureWantToVisitRow(auth.user.id);
              setWantToVisit(profile.thingy_id.includes(selectedPoiData.id));
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
      fetchMeta();
    }, [messages, selectedPoiData]);

    // Helpers
    const sendComment = async (content: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase.from('messages').insert({
        thingy_id: selectedPoiData?.id,
        user_id: auth.user.id,
        content,
      });
      setComment('');
    };

    const handleAddToVisit = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error('Not signed in');

        const profile = await ensureWantToVisitRow(auth.user.id);
        const existing = profile.thingy_id || [];
        if (existing.includes(selectedPoiData!.id)) {
          setWantToVisit(true);
          return;
        }

        const updated = [...existing, selectedPoiData!.id];
        await supabase
          .from('want_to_visit')
          .upsert({ uid: auth.user.id, thingy_id: updated }, { onConflict: 'uid' });
        setWantToVisit(true);
      } catch (err) {
        console.error(err);
      }
    };

    const handleRemoveFromVisit = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error('Not signed in');

        const profile = await ensureWantToVisitRow(auth.user.id);
        const existing = profile.thingy_id || [];
        const updated = existing.filter(id => id !== selectedPoiData!.id);

        await supabase
          .from('want_to_visit')
          .upsert({ uid: auth.user.id, thingy_id: updated }, { onConflict: 'uid' });
        setWantToVisit(false);
      } catch (err) {
        console.error(err);
      }
    };

    if (!selectedPoiData?.id) return null;

    return (
      <BottomSheetModal
        ref={sheetRef}
        index={initialIndex}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>{selectedPoiData.title}</Text>
          <Text style={styles.type}>
            {selectedPoiData.type === 'event' ? '🎟️ Event' :
            selectedPoiData.type === 'food' ? '🍽️ Food Spot' :
            selectedPoiData.type === 'view' ? '🌆 Scenic View' :
            selectedPoiData.type === 'hidden' ? '🕵️ Hidden Gem' : 
            selectedPoiData.type === 'share' ? '📢 Shared Location' :
            selectedPoiData.type === 'uevent' ? '🎉 User Event' :
            '📍 Landmark'}
          </Text>

          {selectedPoiData.address && <Text style={styles.address}>{selectedPoiData.address}</Text>}

          {wantToVisit ? (
            <Pressable style={styles.visitedContainer} onPress={handleRemoveFromVisit}>
              <MaterialIcons name="bookmark" size={24} color="#fff" />
              <Text style={styles.visitedText}>Want to visit</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.wantToVisitContainer} onPress={handleAddToVisit}>
              <MaterialIcons name="bookmark-border" size={24} color="#F4A261" />
              <Text style={styles.wantToVisitText}>Want to visit</Text>
            </Pressable>
          )}

          <View style={styles.CTAContainer}>
            <Pressable
              onPress={() => openMapWithDirections(selectedPoiData.lat, selectedPoiData.lon)}
              style={styles.directionsButton}
            >
              <MaterialIcons name="directions" size={24} color="#fff" />
              <Text style={styles.directionsText}>Get Directions</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                sheetRef.current?.close();
                router.push(`/checkin/${selectedPoiData.id}`);
              }}
              style={styles.directionsButton}
            >
              <MaterialCommunityIcons name="location-enter" size={24} color="#fff" />
              <Text style={styles.directionsText}>Check-In</Text>
            </Pressable>
          </View>

          {selectedPoiData.description && (
            <Text style={styles.description}>{selectedPoiData.description}</Text>
          )}

          <BottomSheetScrollView style={styles.chatContainer}>
            <Text style={styles.photos}>Photos and Comments</Text>

            {messages.length > 0 ? (
              messages.map(msg => (
                <View key={msg.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: 'bold', color: '#555' }}>{userMap[msg.user_id] || msg.user_id}</Text>
                  <Text style={{ color: '#444' }}>{msg.content}</Text>
                </View>
              ))
            ) : (
              <Text style={{ paddingVertical: 72, textAlign: 'center', color: '#a1a1a1' }}>No comments yet. Be the first to share!</Text>
            )}

            <TextInput
              placeholder="Write a comment..."
              style={{ 
                height: 40, 
                borderColor: '#ccc', 
                borderWidth: 1, 
                borderRadius: 8, 
                paddingHorizontal: 10,
                marginBottom: 10,
              }}
              value={comment}
              onChangeText={(text) => {
                setComment(text);
              }}
              onSubmitEditing={(e) => {
                sendComment(e.nativeEvent.text);
              }}
              placeholderTextColor={'#a1a1a1'}
            />
            <Pressable
              onPress={() => {
                sendComment(comment);
                setComment('');
              }}
              style={{ 
                backgroundColor: comment.trim() ? '#F4A261' : '#ccc', 
                padding: 10, 
                borderRadius: 8, 
                alignItems: 'center',
              }}
              disabled={!comment.trim()}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Send Comment</Text>
            </Pressable>
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

POIModal.displayName = 'POIModal';

export default POIModal;

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: { 
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ccc',
    marginBottom: 8,
  }, 
  content: {
    padding: 16, 
    paddingTop: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8, 
    color: '#333'
  },
  address: {
    fontSize: 14,
  },
  type: {
    fontSize: 14,
    color: '#6B7B78',
    marginBottom: 12,
    fontStyle: 'italic',
  }, 
  description: {
    fontSize: 15,
    color: '#444',
    marginTop: 8,
    marginBottom: 10,
  },
  hours: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6,
  },
  visited: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  unvisited: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  photos: {
    fontSize: 18,
    color: '#262626',
    marginVertical: 8,
    textAlign: 'center',
    fontWeight: '500'
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4A261',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
    flex: 1,
  },
  directionsText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  CTAContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  chatContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  visitedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4A261',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
    flex: 1,
  },
  wantToVisitText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#F4A261',
    fontWeight: 'bold',
  },
  visitedText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  wantToVisitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
    flex: 1,
    borderWidth: 2,
    borderColor: '#F4A261',
  },
})