import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, Image, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Room {
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  capacity: number;
  size: number;
  amenities: string[];
  images: string[];
  rating: number;
  reviews_count: number;
}

interface RoomModalSheetMethods {
  open: (roomId: string) => void;
  close: () => void;
}

interface RoomModalSheetProps {
  onDismiss?: () => void;
}

const RoomModalSheet = forwardRef<RoomModalSheetMethods, RoomModalSheetProps>(({ onDismiss }, ref) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);

  const fetchRoomDetails = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      
      setRoom(data);
      bottomSheetModalRef.current?.present();
    } catch (err) {
      console.error('Error fetching room details:', err);
      setError('Failed to load room details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const open = (id: string) => {
    setRoomId(id);
    fetchRoomDetails(id);
  };

  const close = () => {
    bottomSheetModalRef.current?.dismiss();
    onDismiss?.();
  };

  useImperativeHandle(ref, () => ({
    open,
    close,
  }));

  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => {
      const iconName: 'star' | 'star-outline' = i < Math.floor(rating) ? 'star' : 'star-outline';
      return (
        <MaterialIcons 
          key={i} 
          name={iconName}
          size={16} 
          color="#FFD700" 
        />
      );
    });
  };

  const renderAmenityIcon = (amenity: string) => {
    // Map amenities to MaterialIcons names
    const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
      'wifi': 'wifi',
      'tv': 'tv',
      'ac': 'ac-unit',
      'minibar': 'local-bar',
      'safe': 'security',
      'shower': 'shower',
    };

    const iconName = iconMap[amenity.toLowerCase()] || 'check';

    return (
      <View key={amenity} style={styles.amenityItem}>
        <MaterialIcons name={iconName} size={20} color="#4A89EE" />
        <Text style={styles.amenityText}>{amenity}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <BottomSheetModal ref={bottomSheetModalRef} style={styles.background} snapPoints={[500, '100%']} enablePanDownToClose={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A89EE" />
          <Text style={styles.loadingText}>Loading room details...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  if (error) {
    return (
      <BottomSheetModal ref={bottomSheetModalRef} style={styles.background} snapPoints={[300, '100%']} enablePanDownToClose={true}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => roomId && fetchRoomDetails(roomId)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  }

  if (!room) return null;

  return (
    <BottomSheetModal 
      ref={bottomSheetModalRef} 
      style={styles.background} 
      snapPoints={[500, '100%']} 
      enablePanDownToClose={true}
      onDismiss={onDismiss}
    >
      <BottomSheetView style={styles.container}>
        <BottomSheetScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Gallery */}
          <View style={styles.imageContainer}>
            {room.images?.[0] ? (
              <Image 
                source={{ uri: room.images[0] }} 
                style={styles.roomImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.roomImage, styles.imagePlaceholder]}>
                <MaterialIcons name="image-not-supported" size={50} color="#ccc" />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.imageGradient}
            />
            <Pressable style={styles.closeButton} onPress={close}>
              <MaterialIcons name="close" size={24} color="white" />
            </Pressable>
            <View style={styles.imagePagination}>
              {room.images?.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.paginationDot,
                    index === activeImageIndex && styles.activeDot
                  ]} 
                />
              ))}
            </View>
          </View>


          {/* Room Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.roomName}>{room.name}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>${room.price_per_night}</Text>
                <Text style={styles.perNight}>/ night</Text>
              </View>
            </View>

            <View style={styles.ratingContainer}>
              <View style={styles.starsContainer}>
                {renderStars(room.rating || 0)}
              </View>
              <Text style={styles.ratingText}>
                {room.rating?.toFixed(1)} ({room.reviews_count || 0} reviews)
              </Text>
            </View>

            <View style={styles.roomInfo}>
              <View style={styles.infoItem}>
                <MaterialIcons name="people" size={20} color="#666" />
                <Text style={styles.infoText}>{room.capacity} Guests</Text>
              </View>
              <View style={styles.infoItem}>
                <MaterialIcons name="straighten" size={20} color="#666" />
                <Text style={styles.infoText}>{room.size} m²</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>About This Room</Text>
            <Text style={styles.description}>{room.description}</Text>

            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesContainer}>
              {room.amenities?.map(amenity => renderAmenityIcon(amenity))}
            </View>
          </View>
        </BottomSheetScrollView>

        {/* Book Now Button */}
        <View style={styles.footer}>
          <Pressable style={styles.bookButton} onPress={() => {}}>
            <Text style={styles.bookButtonText}>Book Now</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    zIndex: 1000,
  },
  content: {
    flex: 1,
    paddingBottom: 100, // Space for the fixed button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4A89EE',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  imageContainer: {
    height: 250,
    width: '100%',
    position: 'relative',
  },
  roomImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: 'white',
    width: 16,
  },
  detailsContainer: {
    padding: 24,
    paddingBottom: 120, // Extra padding for the fixed button
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomName: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A89EE',
  },
  perNight: {
    fontSize: 14,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    color: '#666',
    fontSize: 14,
  },
  roomInfo: {
    flexDirection: 'row',
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  infoText: {
    marginLeft: 8,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#444',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  bookButton: {
    backgroundColor: '#4A89EE',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  background: {
    zIndex: 1000,
  },
});

export default RoomModalSheet;
