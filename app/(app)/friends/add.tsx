import { GlassSegmentedControl, useNativeHeader } from "@/components/ui";
import { getUser } from "@/lib/getUserHandle";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { fonts } from "@/constants/typography";

type FriendUser = {
  id: string;
  name?: string;
  email?: string;
  code: string;
  class?: string;
  color?: string;
};

const AddFriendScreen = () => {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"add" | "requests">(
    initialTab === "requests" ? "requests" : "add"
  );

  const [code, setCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [friend, setFriend] = useState<FriendUser | null>(null);
  const [user, setUser] = useState<any>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("Lisää kaveri");

  const [requests, setRequests] = useState<any[]>([]);
  const [requesters, setRequesters] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    const fetchUser = async () => {
      const u = await getUser();
      setUser(u);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) loadRequests();
  }, [user]);

  const loadRequests = async () => {
    setIsLoadingRequests(true);

    const { data, error } = await supabase
      .from("relations")
      .select("*")
      .eq("status", "request")
      .eq("object", user?.id);

    if (error || !data || data.length === 0) {
      setRequests([]);
      setRequesters([]);
      setIsLoadingRequests(false);
      return;
    }

    setRequests(data);

    const users: any[] = [];
    for (const requester of data) {
      const { data: userData, error: userError } = await supabase
        .from("users_public")
        .select("*")
        .eq("id", requester.subject);

      if (!userError && userData && userData.length > 0) {
        users.push(userData[0]);
      }
    }
    setRequesters(users);
    setIsLoadingRequests(false);
  };

  const handleSearch = async (searchCode: string) => {
    if (searchCode.length !== 6 || isSearching) return;

    setIsSearching(true);

    const searchPromise = supabase
      .from("users_public")
      .select("*")
      .eq("code", searchCode)
      .single();

    const delay = new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const [{ data, error }] = await Promise.all([searchPromise, delay]);

      setIsSearching(false);

      if (error) {
        setFriend(null);
        setRequestSent(false);
        setButtonLabel("Lisää kaveri");
        return;
      }

      const { data: checkIfBlocked, error: blockError } = await supabase
        .from("relations")
        .select("*")
        .eq("object", user?.id)
        .eq("subject", data.id)
        .eq("status", "blocked");

      if (!blockError && checkIfBlocked && checkIfBlocked.length > 0) {
        setFriend(null);
        setButtonLabel("Lisää kaveri");
        setRequestSent(false);
        return;
      }

      setFriend(data);

      const { data: relations, error: relationsError } = await supabase
        .from("relations")
        .select("*")
        .or(
          `and(subject.eq.${user?.id},object.eq.${data.id}),and(subject.eq.${data.id},object.eq.${user?.id})`
        );

      if (!relationsError && relations && relations.length > 0) {
        const relation = relations[0];
        if (relation.status === "request") {
          setRequestSent(true);
          setButtonLabel("Pyydetty");
        } else if (relation.status === "friends") {
          setButtonLabel("Kaverisi");
        }
      }
    } catch (err) {
      console.log("Unexpected error:", err);
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (userId === user?.id) return;

    const { data: relations, error: relationsError } = await supabase
      .from("relations")
      .select("*")
      .or(
        `and(subject.eq.${user?.id},object.eq.${userId}),and(subject.eq.${userId},object.eq.${user?.id})`
      );

    if (relationsError || (relations && relations.length > 0)) return;

    const { error } = await supabase.from("relations").insert({
      subject: user?.id,
      object: userId,
      status: "request",
    });

    if (!error) {
      setRequestSent(true);
      setButtonLabel("Pyydetty");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    await supabase
      .from("relations")
      .update({ status: "friends" })
      .or(
        `and(subject.eq.${requestId},object.eq.${user?.id}),and(subject.eq.${user?.id},object.eq.${requestId})`
      );
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase
      .from("relations")
      .delete()
      .or(
        `and(subject.eq.${requestId},object.eq.${user?.id}),and(subject.eq.${user?.id},object.eq.${requestId})`
      );
  };

  // Compact, not large: there is no scroll view at the root for a large
  // title to collapse against. "flat" is the white/near-black this page
  // already uses, so the bar blends into it.
  const header = useNativeHeader({
    title: "Kaverit",
    background: "flat",
    large: false,
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={header} />

      {/* Floats over the content on iOS, so it is first in the tree with a
          zIndex rather than last; on Android it is the in-flow tab bar. */}
      <GlassSegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          ["add", "Lisää kaveri"],
          [
            "requests",
            requesters.length > 0
              ? `Kaveripyynnöt (${requesters.length})`
              : "Kaveripyynnöt",
          ],
        ]}
        style={styles.floatingTabs}
      />

      {activeTab === "add" && (
        <View
          style={[
            styles.content,
            Platform.OS === "ios" && styles.belowFloatingTabs,
            isDark && { backgroundColor: "#18191B" },
          ]}
        >
          <Text style={[styles.title, isDark && { color: "#fff" }]}>
            Anna kaverisi koodi
          </Text>
          <Text style={[styles.subtitle, isDark && { color: "#AAA" }]}>
            Kysy ystävältäsi heidän 6-numeroinen koodi
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
                setButtonLabel("Lisää kaveri");
                if (value.length === 6 && !isSearching) {
                  handleSearch(value);
                }
              }}
              placeholder="123456"
              placeholderTextColor="#aaa"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              selectionColor="#3478F5"
            />
          </View>

          {code.length === 6 && !isSearching && friend === null && (
            <View style={styles.resultContainer}>
              <MaterialIcons name="travel-explore" size={48} color="#999" />
              <Text style={[styles.resultText, isDark && { color: "#e5e5e5" }]}>
                Kaveria ei löytynyt
              </Text>
              <Text
                style={[
                  styles.hintText,
                  { marginTop: 6 },
                  isDark && { color: "#AAA" },
                ]}
              >
                Tarkista koodi ja kokeile uudelleen
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
                  color={isDark ? "#fff" : "#3478F5"}
                />
                <Text style={[styles.resultText, isDark && { color: "#fff" }]}>
                  {friend.name}
                </Text>
                {friend.class && (
                  <Text
                    style={[styles.hintText, isDark && { color: "#AAA" }]}
                  >
                    {friend.class}
                  </Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.addFriendButton,
                    requestSent && styles.addFriendButtonSent,
                    buttonLabel === "Kaverisi" && {
                      backgroundColor: "#2b7fff",
                    },
                    buttonLabel === "Pyydetty" && {
                      backgroundColor: "#e5e5e5",
                    },
                    pressed && styles.addFriendButtonPressed,
                  ]}
                  onPress={() => handleAddFriend(friend.id)}
                  disabled={requestSent || buttonLabel === "Kaverisi"}
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
                    { fontSize: 24, ...fonts.semiBold },
                    isDark && { color: "#fff" },
                  ]}
                >
                  Tämä on sinun koodisi!
                </Text>
              </View>
            )}
        </View>
      )}

      {activeTab === "requests" && (
        <View
          style={[
            styles.requestsContent,
            Platform.OS === "ios" && styles.belowFloatingTabs,
            isDark && { backgroundColor: "#18191B" },
          ]}
        >
          {isLoadingRequests ? (
            <View style={styles.noRequestsContainer}>
              <ActivityIndicator size="large" color="#3478F5" />
            </View>
          ) : requesters.length === 0 ? (
            <View style={styles.noRequestsContainer}>
              <Text
                style={[styles.noRequestsText, isDark && { color: "#e5e5e5" }]}
              >
                Ei kaveripyyntöjä
              </Text>
              <Text
                style={[styles.noRequestsHint, isDark && { color: "#AAA" }]}
              >
                Jaa koodisi ystävillesi
              </Text>
            </View>
          ) : (
            <FlatList
              data={requesters}
              renderItem={({ item }) => (
                <View style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text
                      style={[
                        styles.requestName,
                        isDark && { color: "#fff" },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.requestClass,
                        isDark && { color: "#ffffff80" },
                      ]}
                    >
                      {item.class || "Luokka ei tiedossa"}
                    </Text>
                  </View>
                  <View style={styles.requestButtons}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.acceptButton,
                        pressed && styles.acceptButtonPressed,
                      ]}
                      onPress={() => {
                        handleAcceptRequest(item.id);
                        setRequesters(
                          requesters.filter((r: any) => r.id !== item.id)
                        );
                      }}
                    >
                      <MaterialIcons name="check" size={24} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.rejectButton,
                        pressed && styles.rejectButtonPressed,
                      ]}
                      onPress={() => {
                        handleRejectRequest(item.id);
                        setRequesters(
                          requesters.filter((r: any) => r.id !== item.id)
                        );
                      }}
                    >
                      <MaterialIcons name="clear" size={24} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id}
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  floatingTabs: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  // Clears the floating selector: its 12pt inset plus the capsule's height.
  belowFloatingTabs: { paddingTop: 72 },
  content: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  requestsContent: {
    flex: 1,
    padding: 18,
  },
  title: {
    fontSize: 24,
    ...fonts.semiBold,
    color: "#222",
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
    ...fonts.medium,
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
    ...fonts.semiBold,
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
    backgroundColor: "#3478F5",
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
    ...fonts.semiBold,
    color: "#fff",
    textAlign: "center",
  },
  addFriendTextSent: {
    color: "#525252",
  },
  requestItem: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 20,
    ...fonts.semiBold,
    color: "#333",
    marginBottom: 4,
  },
  requestClass: {
    fontSize: 16,
    color: "#666",
  },
  requestButtons: {
    flexDirection: "row",
    alignItems: "center",
    width: "32%",
    justifyContent: "space-between",
  },
  acceptButton: {
    backgroundColor: "#3478F5",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptButtonPressed: {
    opacity: 0.8,
  },
  rejectButtonPressed: {
    opacity: 0.8,
  },
  rejectButton: {
    backgroundColor: "#ec003f",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  noRequestsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  noRequestsText: {
    fontSize: 22,
    ...fonts.semiBold,
    color: "#444",
    marginBottom: 12,
  },
  noRequestsHint: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});

export default AddFriendScreen;
