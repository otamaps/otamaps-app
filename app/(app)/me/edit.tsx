import { generateCode } from "@/components/functions/codeGen";
import { supabase } from "@/lib/supabase";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const COLORS = [
  "#fb2c36",
  "#ff6900",
  "#f0b100",
  "#7ccf00",
  "#00c950",
  "#00bba7",
  "#2b7fff",
  "#615fff",
  "#ad46ff",
  "#f6339a",
];

const Edit = () => {
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [classError, setClassError] = useState("");

  const isDark = useColorScheme() === "dark";

  const validateClass = (text: string) => {
    // Only allow numbers and letters, max 3 characters
    const cleaned = text.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

    // If more than 3 characters, don't update
    if (cleaned.length > 3) return;

    // Update the input value
    setUserClass(cleaned);

    // Validate the format only when we have exactly 3 characters
    if (cleaned.length === 3) {
      if (/^\d{2}[A-Za-z]$/.test(cleaned)) {
        setClassError("");
      } else {
        setClassError("Syötä luokka muodossa 24A");
      }
    } else if (cleaned.length > 0) {
      // Show error if we have some input but not enough
      setClassError("Syötä 2 numeroa ja 1 kirjain");
    } else {
      setClassError("");
    }
  };

  useEffect(() => {
    // Load current user data
    const loadUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // In a real app, you would fetch the user's current data here
        // For now, we'll use placeholder data
        setName(user.user_metadata?.full_name || "");
        setUserClass(user.user_metadata?.class || "");
        setSelectedColor(user.user_metadata?.color || COLORS[0]);
      }
    };

    loadUserData();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Anna nimesi");
      return;
    }

    if (
      userClass &&
      userClass.length === 3 &&
      !/^\d{2}[A-Za-z]$/.test(userClass)
    ) {
      alert("Tarkista luokan muoto (esim. 24A)");
      return;
    }

    setIsLoading(true);
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Käyttäjää ei löytynyt");

      // Update user metadata in auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          class: userClass.trim(),
          color: selectedColor,
          code: generateCode(user.email as string),
        },
      });

      if (updateError) throw updateError;

      // Update users table

      // Get user's email
      const email = user.email;
      const code = generateCode(email as string);

      const { error: dbError } = await supabase
        .from("users")
        .update({
          id: user.id,
          name: name.trim(),
          class: userClass.trim(),
          color: selectedColor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (dbError) throw dbError;

      router.back();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Profiilin päivitys epäonnistui. Yritä uudelleen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <Stack.Screen
        options={{
          title: "Edit Profile",
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
        contentContainerStyle={[
          styles.scrollContainer,
          isDark && { backgroundColor: "#1e1e1e" },
        ]}
      >
        <View
          style={[styles.section, isDark && { backgroundColor: "#1e1e1e" }]}
        >
          <Text style={[styles.label, isDark && { color: "#fff" }]}>Nimi</Text>
          <TextInput
            style={[
              styles.input,
              isDark && {
                color: "#fff",
                backgroundColor: "#262626",
                borderColor: "#404040",
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Kirjoita nimesi"
            placeholderTextColor="#999"
          />
        </View>

        <View
          style={[styles.section, isDark && { backgroundColor: "#1e1e1e" }]}
        >
          <Text style={[styles.label, isDark && { color: "#fff" }]}>
            Luokka
          </Text>
          <TextInput
            style={[
              styles.input,
              classError && styles.inputError,
              isDark && {
                color: "#fff",
                backgroundColor: "#262626",
                borderColor: "#404040",
              },
            ]}
            value={userClass}
            onChangeText={validateClass}
            placeholder="Esimerkiksi 24Q"
            placeholderTextColor="#999"
            maxLength={3}
            autoCapitalize="characters"
          />
          {classError ? (
            <Text style={styles.errorText}>{classError}</Text>
          ) : null}
        </View>

        <View
          style={[styles.section, isDark && { backgroundColor: "#1e1e1e" }]}
        >
          <Text style={[styles.label, isDark && { color: "#fff" }]}>
            Profiilin väri
          </Text>
          <View style={styles.colorsContainer}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColor,
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={24} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.previewSection,
            isDark && { backgroundColor: "#1e1e1e", borderTopColor: "#404040" },
          ]}
        >
          <Text style={[styles.label, isDark && { color: "#fff" }]}>
            Esikatselu
          </Text>
          <View style={styles.previewContainer}>
            <View
              style={[styles.previewAvatar, { backgroundColor: selectedColor }]}
            >
              <Text style={styles.avatarText}>
                {name ? name.charAt(0).toUpperCase() : "?"}
              </Text>
            </View>
            <View style={styles.previewTextContainer}>
              <Text style={[styles.previewName, isDark && { color: "#fff" }]}>
                {name || "Nimi"}
              </Text>
              <Text
                style={[styles.previewClass, isDark && { color: "#ffffff90" }]}
              >
                {userClass || "Luokka"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          isDark && { backgroundColor: "#1e1e1e", borderTopColor: "#404040" },
        ]}
      >
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Tallennetaan..." : "Tallenna muutokset"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Figtree-Regular",
    backgroundColor: "#f9f9f9",
    color: "#000",
  },
  colorsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
    width: "100%",
    marginHorizontal: -5,
    height: 120,
  },
  colorOption: {
    width: "18%",
    aspectRatio: 1,
    height: 50,
    maxWidth: 60,
    minWidth: 50,
    borderRadius: 30,
    margin: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColor: {
    borderColor: "#333",
    transform: [{ scale: 1.1 }],
  },
  previewSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  previewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    color: "white",
    fontSize: 24,
    fontFamily: "Figtree-Bold",
  },
  previewTextContainer: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontFamily: "Figtree-SemiBold",
    marginBottom: 4,
  },
  previewClass: {
    fontSize: 16,
    color: "#666",
    fontFamily: "Figtree-Regular",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
  },
  buttonDisabled: {
    backgroundColor: "#007AFF80",
  },
  inputError: {
    borderColor: "#FF6B6B",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Figtree-Regular",
  },
});

export default Edit;
