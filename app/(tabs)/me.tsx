import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type UserProfile = {
  name: string;
  class?: string;
  color: string;
  email?: string;
};

const Me = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("No user found");

        // Get user metadata from auth
        const userData = {
          name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Käyttäjä",
          class: user.user_metadata?.class || "",
          color: user.user_metadata?.color || "#4A89EE",
          email: user.email,
        };

        // Try to get additional data from users table
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("name, class, color")
          .eq("id", user.id)
          .single();

        if (!profileError && profileData) {
          setProfile({
            ...userData,
            ...profileData,
            name: profileData.name || userData.name,
            class: profileData.class || userData.class,
            color: profileData.color || userData.color,
          });
        } else {
          setProfile(userData);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();

    // Set up real-time subscription
    const channel = supabase
      .channel("profile_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
        },
        (payload) => {
          if (payload.new) {
            setProfile((prev) => ({
              ...prev,
              ...payload.new,
              name: payload.new.name || prev?.name,
              class: payload.new.class || prev?.class,
              color: payload.new.color || prev?.color,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#1e1e1e" : "transparent",
        }}
      >
        <ActivityIndicator size="large" color={isDark ? "#fff" : "#4A89EE"} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? "#1e1e1e" : "transparent" }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          // marginTop: 40,
          backgroundColor: isDark ? "#1e1e1e" : "transparent",
        }}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={{
            flex: 1,
            width: "100%",
            alignItems: "center",
            backgroundColor: isDark ? "#1e1e1e" : "transparent",
          }}
        >
          <View
            style={[
              styles.userContainer,
              isDark && { backgroundColor: "#404040" },
            ]}
          >
            <View style={styles.userRow}>
              <View
                style={[
                  styles.avatarContainer,
                  { backgroundColor: profile?.color || "#4A89EE" },
                ]}
              >
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text
                  style={[
                    styles.nameText,
                    { fontSize: 24 },
                    isDark && { color: "#fff" },
                  ]}
                >
                  {profile?.name || "Käyttäjä"}
                </Text>
                {profile?.class && (
                  <Text
                    style={[
                      styles.nameText,
                      { fontSize: 16, color: "#666" },
                      isDark && { color: "#ffffff70" },
                    ]}
                  >
                    {profile.class}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View
            style={[
              styles.optionsContainer,
              isDark && { backgroundColor: "#404040" },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && {
                  backgroundColor: "#404040",
                },

                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => router.push("/me/edit")}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#fff" : "#444",
                }}
              >
                Muokkaa tietojani
              </Text>
            </Pressable>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? "#525252" : "#ddd",
              }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && { backgroundColor: "#404040" },
                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => router.push("/me/wilma")}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#fff" : "#444",
                }}
              >
                Yhdistä Wilma-tili
              </Text>
            </Pressable>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? "#525252" : "#ddd",
              }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && { backgroundColor: "#404040" },
                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => router.push("/me/settings")}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#fff" : "#444",
                }}
              >
                Asetukset
              </Text>
            </Pressable>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? "#525252" : "#ddd",
              }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && { backgroundColor: "#404040" },
                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => router.push("/me/guide")}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#fff" : "#444",
                }}
              >
                Ohje
              </Text>
            </Pressable>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? "#525252" : "#ddd",
              }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && { backgroundColor: "#404040" },
                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => router.push("/me/about")}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#fff" : "#444",
                }}
              >
                Tietoja
              </Text>
            </Pressable>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? "#525252" : "#ddd",
              }}
            />
            <Pressable
              style={({ pressed }) => [
                styles.optionContainer,
                isDark && { backgroundColor: "#404040" },
                pressed && styles.optionContainerPressed,
                isDark && pressed && { backgroundColor: "#525252" },
              ]}
              onPress={() => {
                supabase.auth.signOut();
                router.push("/");
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Figtree-SemiBold",
                  color: isDark ? "#ff637e" : "#ec003f",
                }}
              >
                Kirjaudu ulos
              </Text>
            </Pressable>
          </View>
        </View>

        <TouchableOpacity
          style={{ alignItems: "center", marginBottom: 100, opacity: 0.55 }}
          onPress={() => Linking.openURL("https://streetsmarts.fi/")}
        >
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Figtree-Medium",
              color: isDark ? "#a1a1a1" : "#999",
            }}
          >
            mahdollistanut
          </Text>
          <Image
            source={require("@/assets/images/streetsmarts.png")}
            resizeMode="contain"
            style={{ width: 90, height: 70, marginVertical: 8 }}
            tintColor="#999"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Me;

const styles = StyleSheet.create({
  userContainer: {
    width: "90%",
    margin: 16,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  optionsContainer: {
    width: "90%",
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  optionContainer: {
    borderRadius: 16,
    padding: 16,
    paddingVertical: 20,
    backgroundColor: "#fff",
  },
  optionContainerPressed: {
    padding: 16,
    paddingVertical: 20,
    backgroundColor: "#f5f5f5",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 9,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 28,
    fontFamily: "Figtree-Bold",
  },
  userInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
    color: "#333",
    textTransform: "capitalize",
  },
});
