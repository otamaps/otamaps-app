import useBLEScanner from "@/components/functions/bleScanner";
import {
  isBLEBackgroundEnabled,
  setBLEBackgroundEnabled,
} from "@/lib/bleBackgroundManager";
import { getBlePermissionSnapshot } from "@/lib/blePermissions";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function BLEScreen() {
  const {
    currentRoom,
    status,
    diagnostics,
    getScannedBeacons,
    forceUploadLocation,
  } = useBLEScanner();
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [permissions, setPermissions] = useState<
    Record<string, string | number | boolean>
  >({});

  const refresh = useCallback(async () => {
    const [enabled, permissionState] = await Promise.all([
      isBLEBackgroundEnabled(),
      getBlePermissionSnapshot(),
    ]);
    setBackgroundEnabled(enabled);
    setPermissions(permissionState);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleBackground = async (enabled: boolean) => {
    setBackgroundEnabled(enabled);
    const result = await setBLEBackgroundEnabled(enabled);
    if (result && !result.success) {
      setBackgroundEnabled(result.reason === "bluetooth_off");
      Alert.alert("BLE tracking could not start", result.reason);
    }
    await refresh();
  };

  const beacons = getScannedBeacons();
  const rows = [
    ["Status", status],
    ["Mode", diagnostics.mode],
    ["Consent", diagnostics.consent ? "enabled" : "disabled"],
    ["Bluetooth", diagnostics.bluetoothState],
    ["Service started", formatTime(diagnostics.serviceStartedAt)],
    ["Current room", currentRoom ?? "—"],
    [
      "Last beacon",
      diagnostics.lastBeaconId
        ? `${diagnostics.lastBeaconId} (${diagnostics.lastBeaconRssi ?? "?"} dBm)`
        : "—",
    ],
    ["Selected beacon", diagnostics.selectedBeaconId ?? "—"],
    ["Estimator", diagnostics.estimationMethod ?? "—"],
    ["Contributing beacons", String(diagnostics.contributingBeaconCount)],
    ["Last estimate", formatTime(diagnostics.lastEstimateAt)],
    ["Last scan", formatTime(diagnostics.lastScanAt)],
    ["Last upload attempt", formatTime(diagnostics.lastUploadAttemptAt)],
    ["Last successful upload", formatTime(diagnostics.lastUploadSuccessAt)],
    ["Last upload reason", diagnostics.lastUploadReason ?? "—"],
    ["Pending retry", diagnostics.pendingUpload ? "yes" : "no"],
    ["Last error", diagnostics.lastError ?? "—"],
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: "BLE diagnostics",
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#111827" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.title}>Background tracking</Text>
              <Text style={styles.description}>
                Continues BLE room detection while OtaMaps is not visible.
              </Text>
            </View>
            <Switch
              value={backgroundEnabled}
              onValueChange={(value) => void toggleBackground(value)}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Runtime</Text>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text selectable style={styles.value}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Permissions</Text>
          <Text selectable style={styles.code}>
            {JSON.stringify(permissions, null, 2)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Active beacons ({beacons.length})</Text>
          {beacons.length === 0 ? (
            <Text style={styles.description}>No fresh beacon observations.</Text>
          ) : (
            beacons.map((beacon) => (
              <View key={beacon.id} style={styles.row}>
                <Text selectable style={styles.label}>
                  {beacon.id}
                </Text>
                <Text style={styles.value}>{beacon.rssi} dBm</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => void forceUploadLocation()}
          >
            <Text style={styles.primaryButtonText}>Upload current fix</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void refresh()}>
            <Text style={styles.secondaryButtonText}>Refresh status</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={styles.secondaryButtonText}>Open app settings</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 16, gap: 10 },
  title: { fontSize: 17, fontFamily: "Figtree-SemiBold", color: "#111827" },
  description: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  toggleCopy: { flex: 1, gap: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    paddingTop: 9,
  },
  label: { flex: 1, color: "#4b5563", fontSize: 13 },
  value: { flex: 1, color: "#111827", fontSize: 13, textAlign: "right" },
  code: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    color: "#374151",
  },
  actions: { gap: 10 },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "white", fontFamily: "Figtree-SemiBold" },
  secondaryButton: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#2563eb", fontFamily: "Figtree-SemiBold" },
});
