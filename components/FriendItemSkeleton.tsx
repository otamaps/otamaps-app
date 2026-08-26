import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, useColorScheme, View } from "react-native";

/** Placeholder row shaped like `FriendItem`, shown while friends are first loading. */
function FriendItemSkeleton() {
  const isDark = useColorScheme() === "dark";
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const blockColor = isDark ? "#2E3034" : "#E8ECF2";

  return (
    <Animated.View style={[styles.container, { opacity: pulse }]}>
      <View style={[styles.avatar, { backgroundColor: blockColor }]} />
      <View style={styles.details}>
        <View style={[styles.bar, styles.nameBar, { backgroundColor: blockColor }]} />
        <View style={[styles.bar, styles.metaBar, { backgroundColor: blockColor }]} />
      </View>
    </Animated.View>
  );
}

export default function FriendListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <FriendItemSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 16,
    marginVertical: 6,
    marginHorizontal: 16,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, marginRight: 16 },
  details: { flex: 1, gap: 8 },
  bar: { height: 12, borderRadius: 6 },
  nameBar: { width: "45%" },
  metaBar: { width: "70%", height: 10 },
});
