import { AppText, Row, Surface, useNativeHeader } from "@/components/ui";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet } from "react-native";

const SPONSORS = [
  { name: "Otaniemen lukion vanhempainyhdistys", logo: null },
  {
    name: "Otaniemen lukion opiskelijakunnan hallitus",
    logo: require("@/assets/images/Hallitus_Logo.png"),
  },
  {
    name: "Streetsmarts Autokoulu",
    logo: require("@/assets/images/streetsmarts.png"),
  },
];

export default function About() {
  const router = useRouter();
  const header = useNativeHeader({ title: "Tietoja", background: "page" });

  // A ref, not state: nothing renders the count, and as state every tap
  // re-rendered the screen to no purpose.
  const logoTapCount = React.useRef(0);
  const logoTapTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Ten taps on the logo opens the hidden screen; the count lapses after a
  // pause so an idle streak cannot be finished days later.
  const handleLogoTap = () => {
    logoTapCount.current += 1;
    if (logoTapCount.current === 10) {
      logoTapCount.current = 0;
      router.push("/me/secret");
      return;
    }
    if (logoTapTimeout.current) clearTimeout(logoTapTimeout.current);
    logoTapTimeout.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, 1500);
  };

  React.useEffect(() => {
    return () => {
      if (logoTapTimeout.current) clearTimeout(logoTapTimeout.current);
    };
  }, []);

  const version = Constants.expoConfig?.version || "0.0.1";
  const build = Constants.expoConfig?.android?.versionCode;

  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={handleLogoTap}
          hitSlop={20}
          accessibilityLabel="OtaMaps"
          style={styles.logoWrap}
        >
          <Image
            source={require("@/assets/images/otamaps-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>

        <Surface>
          <Row>
            <AppText variant="body" style={styles.label}>
              Versio
            </AppText>
            <AppText variant="body" color="textMuted">
              {build ? `${version} (${build})` : version}
            </AppText>
          </Row>
          <Row>
            <AppText variant="body" style={styles.label}>
              Tekijänoikeus
            </AppText>
            <AppText variant="body" color="textMuted">
              © {new Date().getFullYear()} OtaMaps
            </AppText>
          </Row>
        </Surface>

        <Surface title="Sponsorit">
          {SPONSORS.map((sponsor) => (
            <Row key={sponsor.name}>
              {sponsor.logo ? (
                <Image
                  source={sponsor.logo}
                  style={styles.sponsorLogo}
                  resizeMode="contain"
                />
              ) : null}
              <AppText variant="body" style={styles.label}>
                {sponsor.name}
              </AppText>
            </Row>
          ))}
        </Surface>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  logoWrap: { alignItems: "center", paddingTop: 8 },
  logo: { width: 200, height: 96 },
  label: { flex: 1 },
  sponsorLogo: { width: 40, height: 40 },
});
