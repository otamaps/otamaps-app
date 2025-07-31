import { MaterialIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const GuideItem = ({
  icon,
  title,
  text,
  isDark,
}: {
  icon: string;
  title: string;
  text: string;
  isDark: boolean;
}) => (
  <View style={[styles.guideItem, isDark && { backgroundColor: "#1e1e1e" }]}>
    <View
      style={[
        styles.iconContainer,
        isDark && { backgroundColor: "#4A89EE20", borderColor: "#4A89EE" },
      ]}
    >
      <MaterialIcons name={icon as any} size={20} color="#4A89EE" />
    </View>
    <View style={styles.textContainer}>
      <Text style={[styles.title, isDark && { color: "white" }]}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  </View>
);

const Guide = () => {
  const isDark = useColorScheme() === "dark";
  return (
    <ScrollView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <Stack.Screen
        options={{
          title: "Käyttöohje",
          headerStyle: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
          headerTitleStyle: { color: isDark ? "#fff" : "#000" },
        }}
      />

      <GuideItem
        icon="map"
        title="Kartan käyttö"
        text="Selaa karttaa raahaamalla sormella. Laajenna tai kavenna karttaa liittämällä sormet lähemmäs toisiaan tai loitontamalla."
        isDark={isDark}
      />

      <GuideItem
        icon="person-pin"
        title="Oma sijainti"
        text="Paina sinistä sijaintinappia keskittyäksesi omaan sijaintiisi. Varmista, että sijaintipalvelut ovat päällä laitteessasi."
        isDark={isDark}
      />

      <GuideItem
        icon="search"
        title="Haku"
        text="Etsi luokkahuoneita ja tiloja yläpalkin hakukentän avulla. Voit hakea esimerkiksi huonenumerolla tai tilan nimellä."
        isDark={isDark}
      />

      <GuideItem
        icon="people"
        title="Kaverit"
        text="Näet kaveriesi sijainnit kartalla. Paina kaverin kuvaketta nähdäksesi hänen sijaintinsa ja viimeksi nähdyn ajan."
        isDark={isDark}
      />

      <GuideItem
        icon="notifications"
        title="Ilmoitukset"
        text="Saat ilmoituksia, kun kaverisi on lähellä tai kun he lähettävät sinulle viestin."
        isDark={isDark}
      />

      <View
        style={[
          styles.tipBox,
          isDark && { backgroundColor: "#4A89EE10", borderColor: "#4A89EE20" },
        ]}
      >
        <Text style={[styles.tipTitle, isDark && { color: "white" }]}>
          Vinkki:
        </Text>
        <Text style={[styles.tipText, isDark && { color: "#bedbff" }]}>
          Jos et löydä haluamaasi tilaa, kokeile hakea sen numerolla.
          Esimerkiksi "1315"
        </Text>
      </View>

      <Text style={[styles.contactTitle, isDark && { color: "white" }]}>
        Tarvitsetko apua?
      </Text>
      <Text style={[styles.contactText, isDark && { color: "#ffffff90" }]}>
        Ota yhteyttä: tuki@otamaps.fi
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    fontSize: 20,
    fontFamily: "Figtree-SemiBold",
    marginBottom: 24,
    color: "#1a1a1a",
    textAlign: "center",
  },
  guideItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  iconContainer: {
    backgroundColor: "#EFF4FF",
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#333",
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    fontFamily: "Figtree-Regular",
    color: "#666",
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: "#F8FAFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EFF4FF",
  },
  tipTitle: {
    fontFamily: "Figtree-SemiBold",
    color: "#1a1a1a",
    fontSize: 15,
    marginBottom: 6,
  },
  tipText: {
    color: "#4a5568",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Figtree-Regular",
  },
  contactTitle: {
    fontSize: 15,
    fontFamily: "Figtree-SemiBold",
    color: "#1a1a1a",
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  contactText: {
    fontSize: 15,
    fontFamily: "Figtree-Medium",
    color: "#4A89EE",
    textAlign: "center",
    marginBottom: 24,
  },
});

export default Guide;
