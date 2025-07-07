import { MaterialIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const GuideItem = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <View style={styles.guideItem}>
    <View style={styles.iconContainer}>
      <MaterialIcons name={icon as any} size={20} color="#4A89EE" />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  </View>
);

const Guide = () => {
  return (
    <ScrollView style={styles.container}>   
      <Stack.Screen options={{ title: 'Käyttöohje' }} />
       
      <GuideItem
        icon="map"
        title="Kartan käyttö"
        text="Selaa karttaa raahaamalla sormella. Laajenna tai kavenna karttaa liittämällä sormet lähemmäs toisiaan tai loitontamalla."
      />
      
      <GuideItem
        icon="person-pin"
        title="Oma sijainti"
        text="Paina sinistä sijaintinappia keskittyäksesi omaan sijaintiisi. Varmista, että sijaintipalvelut ovat päällä laitteessasi."
      />
      
      <GuideItem
        icon="search"
        title="Haku"
        text="Etsi luokkahuoneita ja tiloja yläpalkin hakukentän avulla. Voit hakea esimerkiksi huonenumerolla tai tilan nimellä."
      />
      
      <GuideItem
        icon="people"
        title="Kaverit"
        text="Näet kaveriesi sijainnit kartalla. Paina kaverin kuvaketta nähdäksesi hänen sijaintinsa ja viimeksi nähdyn ajan."
      />
      
      <GuideItem
        icon="notifications"
        title="Ilmoitukset"
        text="Saat ilmoituksia, kun kaverisi on lähellä tai kun he lähettävät sinulle viestin."
      />
      
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Vinkki:</Text>
        <Text style={styles.tipText}>Jos et löydä haluamaasi tilaa, kokeile hakea sen numerolla. Esimerkiksi "1315"</Text>
      </View>
      
      <Text style={styles.contactTitle}>Tarvitsetko apua?</Text>
      <Text style={styles.contactText}>Ota yhteyttä: tuki@otamaps.fi</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    fontSize: 20,
    fontFamily: 'Figtree-SemiBold',
    marginBottom: 24,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  iconContainer: {
    backgroundColor: '#EFF4FF',
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    fontFamily: 'Figtree-Regular',
    color: '#666',
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFF4FF',
  },
  tipTitle: {
    fontFamily: 'Figtree-SemiBold',
    color: '#1a1a1a',
    fontSize: 15,
    marginBottom: 6,
  },
  tipText: {
    color: '#4a5568',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Figtree-Regular',
  },
  contactTitle: {
    fontSize: 15,
    fontFamily: 'Figtree-SemiBold',
    color: '#1a1a1a',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  contactText: {
    fontSize: 15,
    fontFamily: 'Figtree-Medium',
    color: '#4A89EE',
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default Guide;
