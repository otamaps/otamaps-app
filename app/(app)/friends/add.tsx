import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

type FriendUser = {
  id: string;
  name?: string;
  email?: string;
  code: string;
  class?: string;
  color?: string;
};

const AddFriendScreen = () => {
  const [code, setCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [user, setUser] = useState<any>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("Add friend");
  const isDark = useColorScheme() === "dark";

  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    fetchUser();
  }, []);

  const handleSearch = async (code: string) => {
    if (code.length !== 6 || isSearching) return;

    setIsSearching(true);

    const searchPromise = supabase
      .from("users_public")
      .select("*")
      .eq("code", code)
      .single();

    const delay = new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const [{ data, error }] = await Promise.all([searchPromise, delay]);

      setIsSearching(false);

      if (error) {
        console.log("Error fetching user:", error);
        setFriend(null);
        setRequestSent(false);
        setButtonLabel("Add friend");
      } else {
        setFriend(data);
        console.log("User found:", data);
        const { data: relations, error: relationsError } = await supabase
          .from("relations")
          .select("*")
          .or(
            `and(subject.eq.${user?.id},object.eq.${data.id}),and(subject.eq.${data.id},object.eq.${user?.id})`
          );

        if (relationsError) {
          console.log("Error fetching relations:", relationsError);
          setRequestSent(false);
          setButtonLabel("Add friend");
        }

        console.log("Relations:", relations, user?.id, data.id);

        if (relations && relations.length > 0) {
          const relation = relations[0];
          if (relation.status === "request") {
            setRequestSent(true);
            setButtonLabel("Requested");
          } else if (relation.status === "friends") {
            setButtonLabel(`Friends `);
          }
        }
      }
    } catch (err) {
      console.log("Unexpected error:", err);
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (userId === user?.id) {
      console.log("You cannot add yourself as a friend");
      return;
    }

    const { data: relations, error: relationsError } = await supabase
      .from("relations")
      .select("*")
      .or(
        `and(subject.eq.${user?.id},object.eq.${userId}),and(subject.eq.${userId},object.eq.${user?.id})`
      );

    if (relationsError) {
      console.log("Error fetching relations:", relationsError);
      return;
    }

    if (relations && relations.length > 0) {
      console.log("Relation already exists");
      return;
    }

    const { error } = await supabase.from("relations").insert({
      subject: user?.id,
      object: userId,
      status: "request",
    });

    if (error) {
      console.log("Error adding friend:", error);
    } else {
      console.log("Friend added successfully");
      setRequestSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{
          title: "Add Friend",
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

      <View style={styles.content}>
        <Text style={[styles.title, isDark && { color: "#fff" }]}>
          Enter Friend's Code
        </Text>
        <Text style={[styles.subtitle, isDark && { color: "#a1a1a1" }]}>
          Ask your friend for their 6-digit code
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              isDark && {
                color: "#fff",
                backgroundColor: "#262626",
                borderColor: "#404040",
              },
            ]}
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setFriend(null);
              setRequestSent(false);
              setButtonLabel("Add friend");
              if (value.length === 6 && !isSearching) {
                handleSearch(value);
              }
            }}
            placeholder="123456"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            selectionColor="#4A89EE"
          />
        </View>

        {code.length === 6 && !isSearching && friend === null && (
          <View style={styles.resultContainer}>
            <MaterialIcons name="travel-explore" size={48} color="#999" />
            <Text style={[styles.resultText, isDark && { color: "#e5e5e5" }]}>
              No friend found
            </Text>
            <Text
              style={[
                styles.hintText,
                { marginTop: 6 },
                isDark && { color: "#a1a1a1" },
              ]}
            >
              Looks like nobody has this code
            </Text>
          </View>
        )}

        {code.length === 6 &&
          !isSearching &&
          friend !== null &&
          friend.id !== user?.id && (
            <View style={styles.resultContainer}>
              <MaterialIcons
                name="person"
                size={48}
                color={isDark ? "#fff" : "#4A89EE"}
              />
              <Text style={[styles.resultText, isDark && { color: "#fff" }]}>
                {friend.name}
              </Text>
              {friend.class && (
                <Text style={[styles.hintText, isDark && { color: "#a1a1a1" }]}>
                  {friend.class}
                </Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.addFriendButton,
                  requestSent && styles.addFriendButtonSent,
                  buttonLabel === "Friends" && {
                    backgroundColor: "#e5e5e5",
                  },
                  pressed && styles.addFriendButtonPressed,
                ]}
                onPress={() => {
                  handleAddFriend(friend.id);
                }}
                disabled={requestSent || buttonLabel === "Friends"}
              >
                <Text
                  style={[
                    styles.addFriendText,
                    requestSent && styles.addFriendTextSent,
                  ]}
                >
                  {buttonLabel}
                </Text>
              </Pressable>
            </View>
          )}

        {code.length === 6 &&
          !isSearching &&
          friend !== null &&
          friend.id === user?.id && (
            <View style={styles.resultContainer}>
              <MaterialIcons
                name="favorite"
                size={48}
                color={isDark ? "#ff2056" : "#ec003f"}
              />
              <Text
                style={[
                  styles.resultText,
                  { fontSize: 24, fontFamily: "Figtree-SemiBold" },
                  isDark && { color: "#fff" },
                ]}
              >
                It's You!
              </Text>
            </View>
          )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Figtree-SemiBold",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 32,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    fontFamily: "Figtree-Medium",
    backgroundColor: "#f8f9fa",
    textAlign: "center",
    letterSpacing: 3,
  },
  resultContainer: {
    alignItems: "center",
    padding: 24,
  },
  resultText: {
    fontSize: 18,
    fontFamily: "Figtree-SemiBold",
    color: "#333",
    marginTop: 16,
    textAlign: "center",
  },
  hintText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  addFriendButton: {
    backgroundColor: "#4A89EE",
    padding: 12,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
    width: 180,
  },
  addFriendButtonPressed: {
    opacity: 0.8,
  },
  addFriendButtonSent: {
    backgroundColor: "#e5e5e5",
  },
  addFriendText: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  addFriendTextSent: {
    color: "#525252",
  },
});

export default AddFriendScreen;
