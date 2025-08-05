import {
  configureGoogleSignIn,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from "@/lib/googleAuth";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState(true);

  useEffect(() => {
    // Configure Google Sign-In when component mounts
    configureGoogleSignIn();

    // Check if Google Sign-In is available
    const checkGoogleSignIn = async () => {
      const isAvailable = await isGoogleSignInAvailable();
      setGoogleSignInAvailable(isAvailable);
    };

    checkGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      // Navigation will be handled by the auth state listener in _layout.tsx
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      alert(`Sign in failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={{ marginTop: 16 }}>Kirjaudutaan sisään...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <ImageBackground
          source={require("@/assets/images/login-bg.png")}
          style={styles.backgroundImage}
        >
          <LinearGradient
            colors={["rgba(255,255,255,1)", "rgba(255,255,255,0.2)"]}
            style={styles.topGradient}
            pointerEvents="none"
          />

          <LinearGradient
            colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,1)"]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </ImageBackground>
      </View>
      <View style={styles.overlay}>
        <View style={styles.topContainer}>
          <Text style={styles.tervetuloa}>Tervetuloa!</Text>
          <Image
            source={require("@/assets/images/otamaps-logo.png")}
            style={styles.omLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.logoContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push("/welcome/emailLogin")}
            disabled={loading}
          >
            <LinearGradient
              colors={["#518EEC", "#3478F5"]}
              style={styles.buttonGradient}
              pointerEvents="none"
            />
            <View style={styles.buttonContent}>
              {/* <FontAwesome name="google" size={26} color="white" /> */}
              <Text style={styles.buttonText}>Kirjaudu sisään</Text>
            </View>
          </Pressable>
          {/* <Text style={styles.mahdollistanut}>Mahdollistanut</Text>
          <TouchableOpacity
            style={styles.logo}
            onPress={() => Linking.openURL("https://www.streetsmarts.fi/")}
          >
            <Image
              source={require("@/assets/images/streetsmarts.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity> */}

          <Text style={styles.disclaimer}>
            Kirjautumalla sisään hyväksyt{" "}
            <Text
              style={{ color: "blue" }}
              onPress={() => Linking.openURL("https://otamaps.fi/terms")}
            >
              Käyttöehdot
            </Text>{" "}
            ja{" "}
            <Text
              style={{ color: "blue" }}
              onPress={() => Linking.openURL("https://otamaps.fi/privacy")}
            >
              Tietosuojapolitiikan
            </Text>
          </Text>

          {/* <Pressable 
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed
            ]} 
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <FontAwesome name="google" size={26} color="white" />
              <Text style={styles.buttonText}>Jatka Googlella</Text>
            </View>
          </Pressable> */}

          {/* <Pressable 
            style={({ pressed }) => [
              styles.alternativeButton,
              pressed && styles.buttonPressed
            ]} 
            onPress={() => router.push('/welcome/emailLogin') /* !! change back !! */}
          {/* disabled={loading}
          >
            <View style={styles.alternativeButtonContent}>
              <Text style={styles.alternativeButtonText}>Minulla ei ole @eduespoo.fi -tiliä</Text>
            </View>
          </Pressable> */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  backgroundContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    paddingTop: 50,
    paddingBottom: 0,
    width: "100%",
    height: "100%",
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    position: "relative",
    zIndex: 2,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  topContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: height * 0.05,
    width: "100%",
    flex: 1,
  },
  tervetuloa: {
    fontSize: 28,
    fontFamily: "Figtree-SemiBold",
    textAlign: "center",
    color: "#555",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: height * 0.2,
    width: "100%",
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 30,
  },
  omLogo: {
    width: 250,
    height: 100,
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 150,
  },
  mahdollistanut: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    textAlign: "center",
    color: "#cbb57f",
  },
  button: {
    backgroundColor: "#ff0000",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 20,
    width: "90%",
    marginBottom: 10,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    // paddingLeft: 10,
    fontSize: 18,
    fontFamily: "Figtree-SemiBold",
  },
  alternativeButton: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 20,
    width: "90%",
  },
  alternativeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  alternativeButtonText: {
    color: "#3478F5",
    paddingLeft: 10,
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Figtree-Regular",
    textAlign: "center",
    color: "#666",
    marginTop: 32,
  },
  buttonGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "250%",
    borderRadius: 10,
  },
});
