import {
  AppText,
  Row,
  RowIcon,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

const TOPICS = [
  {
    ios: "map" as const,
    android: "map" as const,
    title: "Kartan käyttö",
    text: "Selaa karttaa raahaamalla sormella. Laajenna tai kavenna karttaa liittämällä sormet lähemmäs toisiaan tai loitontamalla.",
  },
  {
    ios: "location.circle" as const,
    android: "person_pin_circle" as const,
    title: "Oma sijainti",
    text: "Paina sinistä sijaintinappia keskittyäksesi omaan sijaintiisi. Varmista, että sijaintipalvelut ovat päällä laitteessasi.",
  },
  {
    ios: "magnifyingglass" as const,
    android: "search" as const,
    title: "Haku",
    text: "Etsi luokkahuoneita ja tiloja yläpalkin hakukentän avulla. Voit hakea esimerkiksi huonenumerolla tai tilan nimellä.",
  },
  {
    ios: "person.2" as const,
    android: "people" as const,
    title: "Kaverit",
    text: "Näet kaveriesi sijainnit kartalla. Paina kaverin kuvaketta nähdäksesi hänen sijaintinsa ja viimeksi nähdyn ajan.",
  },
  {
    ios: "bell" as const,
    android: "notifications" as const,
    title: "Ilmoitukset",
    text: "Saat ilmoituksia, kun kaverisi on lähellä tai kun he lähettävät sinulle viestin.",
  },
];

export default function Guide() {
  const theme = useTheme();
  const header = useNativeHeader({ title: "Käyttöohje", background: "page" });

  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Surface>
          {TOPICS.map((topic) => (
            <Row key={topic.title} style={styles.topicRow}>
              <RowIcon
                ios={topic.ios}
                android={topic.android}
                color={theme.accent}
              />
              <View style={styles.topicText}>
                <AppText variant="rowTitle">{topic.title}</AppText>
                <AppText variant="meta" color="textMuted" style={styles.topicBody}>
                  {topic.text}
                </AppText>
              </View>
            </Row>
          ))}
        </Surface>

        <Surface title="Vinkki">
          <Row>
            <AppText variant="meta" color="textSecondary" style={styles.tip}>
              Jos et löydä haluamaasi tilaa, kokeile hakea sen numerolla —
              esimerkiksi &quot;1315&quot;.
            </AppText>
          </Row>
        </Surface>

        <Surface title="Tarvitsetko apua?">
          <Row onPress={() => void openExternalUrl("mailto:tuki@otamaps.fi")}>
            <PlatformSymbol
              ios="envelope"
              android="mail"
              size={20}
              tintColor={theme.accent}
            />
            <AppText variant="body" color="accent" style={styles.tip}>
              tuki@otamaps.fi
            </AppText>
          </Row>
        </Surface>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  // The body text makes these rows tall, so they sit on their own padding
  // rather than the row's centred default.
  topicRow: { alignItems: "flex-start", paddingVertical: 14 },
  topicText: { flex: 1 },
  topicBody: { marginTop: 3 },
  tip: { flex: 1 },
});
