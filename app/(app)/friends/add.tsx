import { getUser } from "@/lib/getUserHandle";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
  const router = useRouter();

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

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{
          title: "Kaverit",
          headerStyle: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
          headerTitleStyle: { color: isDark ? "#fff" : "#000" },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons
                name="arrow-back"
                size={24}
                style={{ marginRight: 8 }}
                color={isDark ? "#fff" : "#000"}
              />
            </Pressable>
          ),
        }}
      />

      <View
        style={[
          styles.tabBar,
          isDark && { borderBottomColor: "#404040", backgroundColor: "#1e1e1e" },
        ]}
      >
        <Pressable
          style={[styles.tab, activeTab === "add" && styles.activeTab]}
          onPress={() => setActiveTab("add")}
        >
          <Text
            style={[
              styles.tabText,
              isDark && { color: "#a1a1a1" },
              activeTab === "add" && styles.activeTabText,
            ]}
          >
            Lisää kaveri
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "requests" && styles.activeTab]}
          onPress={() => setActiveTab("requests")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={[
                styles.tabText,
                isDark && { color: "#a1a1a1" },
                activeTab === "requests" && styles.activeTabText,
              ]}
            >
              Kaveripyynnöt
            </Text>
            {requesters.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requesters.length}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {activeTab === "add" && (
        <View style={[styles.content, isDark && { backgroundColor: "#1e1e1e" }]}>
          <Text style={[styles.title, isDark && { color: "#fff" }]}>
            Anna kaverisi koodi
          </Text>
          <Text style={[styles.subtitle, isDark && { color: "#a1a1a1" }]}>
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
                Kaveria ei löytynyt
              </Text>
              <Text
                style={[
                  styles.hintText,
                  { marginTop: 6 },
                  isDark && { color: "#a1a1a1" },
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
                  color={isDark ? "#fff" : "#4A89EE"}
                />
                <Text style={[styles.resultText, isDark && { color: "#fff" }]}>
                  {friend.name}
                </Text>
                {friend.class && (
                  <Text
                    style={[styles.hintText, isDark && { color: "#a1a1a1" }]}
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
                    { fontSize: 24, fontFamily: "Figtree-SemiBold" },
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
            isDark && { backgroundColor: "#1e1e1e" },
          ]}
        >
          {isLoadingRequests ? (
            <View style={styles.noRequestsContainer}>
              <ActivityIndicator size="large" color="#4A89EE" />
            </View>
          ) : requesters.length === 0 ? (
            <View style={styles.noRequestsContainer}>
              <Text
                style={[styles.noRequestsText, isDark && { color: "#e5e5e5" }]}
              >
                Ei kaveripyyntöjä
              </Text>
              <Text
                style={[styles.noRequestsHint, isDark && { color: "#a1a1a1" }]}
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
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#4A89EE",
  },
  tabText: {
    fontSize: 16,
    fontFamily: "Figtree-Medium",
    color: "#666",
  },
  activeTabText: {
    color: "#4A89EE",
    fontFamily: "Figtree-SemiBold",
  },
  badge: {
    backgroundColor: "red",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Figtree-SemiBold",
  },
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
    fontFamily: "Figtree-SemiBold",
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
    backgroundColor: "#4a89ee",
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
    fontFamily: "Figtree-SemiBold",
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
