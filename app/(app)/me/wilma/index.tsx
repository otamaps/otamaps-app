import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const Wilma = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Ionicons name="school" size={32} color="#007AFF" />
        <Text style={styles.title}>Wilma-integraatio</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Miksi yhdistää Wilma-tili?</Text>
                
        <View style={styles.featureItem}>
          <Ionicons name="locate" size={24} color="#007AFF" style={styles.icon} />
          <View>
            <Text style={styles.featureTitle}>Tarkempi sijaintiseuranta</Text>
            <Text style={styles.featureText}>Pystymme parantamaan sijaintiseurantaa luokkatietojesi perusteella.</Text>
          </View>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#007AFF" style={styles.icon} />
          <View>
            <Text style={styles.featureTitle}>Opettajien sijainnin jakaminen</Text>
            <Text style={styles.featureText}>Opettajat voivat jakaa sijaintinsa luokkansa opiskelijoille.</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.note}>
        <Ionicons name="information-circle" size={20} color="#666" />
        <Text style={styles.noteText}>
          Kirjautumalla Wilma-tililläsi hyväksyt, että sovellus käyttää Wilma-tunnuksiasi ainoastaan yllä mainittuihin tarkoituksiin.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Figtree-SemiBold',
    marginLeft: 12,
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: 'Figtree-SemiBold',
    marginBottom: 20,
    color: '#222',
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 16,
    marginTop: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    marginBottom: 4,
    color: '#333',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  note: {
    flexDirection: 'row',
    backgroundColor: '#f0f7ff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
});

export default Wilma;
