import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function EmailLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (isSignUp && !name) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up with email and password
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name.trim(),
                class: "", // Will be set in the profile edit
                color: "#4A89EE", // Default color
              },
            },
          });

        if (signUpError) throw signUpError;

        // Create user profile in the database
        if (authData.user) {
          const { error: profileError } = await supabase.from("users").upsert(
            {
              id: authData.user.id,
              email: email.toLowerCase().trim(),
              name: name.trim(),
              class: "", // Empty class by default
              color: "#4A89EE", // Default color
            },
            {
              onConflict: "id",
            }
          );

          if (profileError) throw profileError;
        }

        // Only show success if we have a user (might be null if email confirmation is required)
        if (authData.user) {
          // Navigate to home after successful signup
          router.replace("/(tabs)/me" as any);
        } else {
          Alert.alert(
            "Check your email",
            "We sent you a confirmation email. Please verify your email to continue."
          );
        }
      } else {
        // Sign in with email and password
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Navigate to home after successful login
        router.replace("/" as any);
      }
    } catch (error: any) {
      const errorMessage =
        error.message || "An error occurred during authentication";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {isSignUp ? "Luo tili" : "Tervetuloa takaisin"}
        </Text>

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Koko nimesi"
            placeholderTextColor="#666666"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Sähköposti"
          placeholderTextColor="#666666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Salasana"
          placeholderTextColor="#666666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          textContentType="oneTimeCode"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? "Luo tili" : "Kirjaudu sisään"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsSignUp(!isSignUp)}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? "Onko sinulla jo tili? Kirjaudu sisään"
              : "Eikö sinulla ole tiliä? Luo tili"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
    color: "#000000",
  },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    color: "#000000",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },
  button: {
    backgroundColor: "#4A89EE",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 24,
    alignItems: "center",
    padding: 12,
  },
  switchText: {
    color: "#4A89EE",
    fontSize: 15,
    fontWeight: "500",
  },
});
