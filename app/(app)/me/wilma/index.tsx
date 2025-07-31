import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const router = useRouter();

const Wilma = () => {
  const isDark = useColorScheme() === "dark";
  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <Stack.Screen
        options={{
          title: "Wilma-integraatio",
          headerStyle: {
            backgroundColor: isDark ? "#1e1e1e" : "#fff",
          },
          headerTitleStyle: {
            color: isDark ? "#fff" : "#000",
          },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#4A89EE" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
        contentContainerStyle={styles.contentContainer}
      >
        {/* <View style={styles.header}>
          <Ionicons
            name="school"
            size={32}
            color={isDark ? "#51a2ff" : "#007AFF"}
          />
          <Text style={[styles.title, isDark && { color: "white" }]}>
            Wilma-integraatio
          </Text>
        </View> */}
        <View
          style={[
            {
              height: 250,
              justifyContent: "center",
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
            },
          ]}
        >
          <Ionicons
            name="hourglass"
            size={64}
            color={isDark ? "#51a2ff" : "#007AFF"}
          />
          <Text
            style={[
              styles.title,
              isDark && { color: "white" },
              {
                textAlign: "center",
                width: "100%",
                fontSize: 24,
                marginTop: 16,
              },
            ]}
          >
            Tulossa pian...
          </Text>
        </View>

        <View style={[styles.card, isDark && { backgroundColor: "#303030" }]}>
          <Text style={[styles.cardTitle, isDark && { color: "white" }]}>
            Miksi yhdistää Wilma-tili?
          </Text>

          <View style={styles.featureItem}>
            <Ionicons
              name="locate"
              size={24}
              color={isDark ? "#51a2ff" : "#007AFF"}
              style={styles.icon}
            />
            <View>
              <Text
                style={[styles.featureTitle, isDark && { color: "#d4d4d4" }]}
              >
                Tarkempi sijaintiseuranta
              </Text>
              <Text
                style={[styles.featureText, isDark && { color: "#ffffff85" }]}
              >
                Pystymme parantamaan sijaintiseurantaa luokkatietojesi
                perusteella.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons
              name="people"
              size={24}
              color={isDark ? "#51a2ff" : "#007AFF"}
              style={styles.icon}
            />
            <View>
              <Text
                style={[styles.featureTitle, isDark && { color: "#d4d4d4" }]}
              >
                Opettajien sijainnin jakaminen
              </Text>
              <Text
                style={[styles.featureText, isDark && { color: "#ffffff85" }]}
              >
                Opettajat voivat jakaa sijaintinsa luokkansa opiskelijoille.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.note, isDark && { backgroundColor: "#303030" }]}>
          <Ionicons
            name="information-circle"
            size={20}
            color={isDark ? "#ffffff85" : "#666"}
          />
          <Text style={[styles.noteText, isDark && { color: "#ffffff85" }]}>
            Kirjautumalla Wilma-tililläsi hyväksyt, että sovellus käyttää
            Wilma-tunnuksiasi ainoastaan yllä mainittuihin tarkoituksiin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: "Figtree-SemiBold",
    // marginLeft: 12,
    color: "#333",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Figtree-SemiBold",
    marginBottom: 20,
    color: "#222",
  },
  featureItem: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
  },
  icon: {
    marginRight: 16,
    marginTop: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    marginBottom: 4,
    color: "#333",
  },
  featureText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  note: {
    flexDirection: "row",
    backgroundColor: "#f0f7ff",
    padding: 16,
    borderRadius: 8,
    alignItems: "flex-start",
  },
  noteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
  },
});

export default Wilma;
