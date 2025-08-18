import { getUser } from "@/lib/getUserHandle";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const RequestsScreen = () => {
  const [user, setUser] = useState<any>(null);
  const [requests, setRequests] = useState<any>([]);
  const [requesters, setRequesters] = useState<any>([]);

  const isDark = useColorScheme() === "dark";
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUser();
      setUser(user);
      console.log(
        `👤 Authenticated user: ${user?.id || "None"} in requests.tsx`
      );
    };
    fetchUser();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [user]);

  useEffect(() => {
    fetchUserInfo();
  }, [requests]);

  const fetchRequests = async () => {
    const { data: requests, error: requestsError } = await supabase
      .from("relations")
      .select("*")
      .eq("status", "request")
      .eq("object", user?.id);

    if (requestsError) {
      console.log("Error fetching requests:", requestsError);
    }

    if (requests && requests.length > 0) {
      setRequests(requests);
    }

    return [];
  };

  const fetchUserInfo = async () => {
    const users: any[] = [];
    for (const requester of requests) {
      const { data: user, error: userError } = await supabase
        .from("users_public")
        .select("*")
        .eq("id", requester.subject);

      if (userError) {
        console.log("Error fetching user info:", userError);
      }

      if (user && user.length > 0) {
        users.push(user[0]);
      }
    }
    setRequesters(users);
  };

  const handleAcceptRequest = async (requestId: string) => {
    console.log("Accepting request...", requestId);
    const { error: acceptError } = await supabase
      .from("relations")
      .update({ status: "friends" })
      .or(
        `and(subject.eq.${requestId},object.eq.${user?.id}),and(subject.eq.${user?.id},object.eq.${requestId})`
      );

    if (acceptError) {
      console.log("Error accepting request:", acceptError);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    console.log("Rejecting request...", requestId);
    const { error: rejectError } = await supabase
      .from("relations")
      .delete()
      .or(
        `and(subject.eq.${requestId},object.eq.${user?.id}),and(subject.eq.${user?.id},object.eq.${requestId})`
      );

    if (rejectError) {
      console.log("Error rejecting request:", rejectError);
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
          title: "Kaveripyynnöt",
          headerTitleStyle: {
            color: isDark ? "#fff" : "#333",
          },
          headerStyle: {
            backgroundColor: isDark ? "#1e1e1e" : "#fff",
          },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={isDark ? "#4A89EE" : "#4A89EE"}
              />
            </Pressable>
          ),
        }}
      />

      <View style={styles.content}>
        {requesters.length === 0 ? (
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
                    style={[styles.requestName, isDark && { color: "#fff" }]}
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
                        requesters.filter(
                          (request: any) => request.id !== item.id
                        )
                      );
                    }}
                  >
                    <MaterialIcons
                      name="check"
                      size={24}
                      color={isDark ? "#fff" : "#fff"}
                    />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.rejectButton,
                      pressed && styles.rejectButtonPressed,
                    ]}
                    onPress={() => {
                      handleRejectRequest(item.id);
                      setRequesters(
                        requesters.filter(
                          (request: any) => request.id !== item.id
                        )
                      );
                    }}
                  >
                    <MaterialIcons
                      name="clear"
                      size={24}
                      color={isDark ? "#fff" : "#fff"}
                    />
                  </Pressable>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
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
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
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
  acceptButtonText: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#fff",
    textAlign: "center",
  },
  rejectButton: {
    backgroundColor: "#ec003f",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  noRequestsContainer: {
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

export default RequestsScreen;
