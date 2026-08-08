import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";

const FABLAB_ENABLED_STORAGE_KEY = "fablabEnabled";

const InfoItem = ({
	icon,
	title,
	text,
	isDark,
}: {
	icon: string;
	title: string;
	text: string;
	isDark: boolean;
}) => (
	<View style={[styles.item, isDark && { backgroundColor: "#1e1e1e" }]}>
		<View
			style={[
				styles.iconContainer,
				isDark && { backgroundColor: "#4A89EE20", borderColor: "#4A89EE" },
			]}
		>
			<MaterialIcons name={icon as any} size={20} color="#4A89EE" />
		</View>
		<View style={styles.textContainer}>
			<Text style={[styles.title, isDark && { color: "white" }]}>{title}</Text>
			<Text style={styles.text}>{text}</Text>
		</View>
	</View>
);

const Fablab = () => {
	const isDark = useColorScheme() === "dark";
	const [isEnabled, setIsEnabled] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const loadValue = useCallback(async () => {
		try {
			const stored = await AsyncStorage.getItem(FABLAB_ENABLED_STORAGE_KEY);
			setIsEnabled(stored === "true");
		} catch (error) {
			console.error("Failed to load Fablab setting:", error);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			loadValue();
		}, [loadValue])
	);

	const onToggle = async (nextValue: boolean) => {
		setIsSaving(true);
		setIsEnabled(nextValue);

		try {
			await AsyncStorage.setItem(
				FABLAB_ENABLED_STORAGE_KEY,
				nextValue.toString()
			);
		} catch (error) {
			console.error("Failed to save Fablab setting:", error);
			setIsEnabled(!nextValue);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<ScrollView
			style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
		>
			<Stack.Screen
				options={{
					title: "Fablab",
					headerStyle: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
					headerTitleStyle: { color: isDark ? "#fff" : "#000" },
					headerTintColor: isDark ? "#fff" : "#000",
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
					styles.toggleCard,
					isDark && { backgroundColor: "#1e1e1e", borderColor: "#404040" },
				]}
			>
				<View style={styles.toggleHeader}>
					<View>
						<Text style={[styles.toggleTitle, isDark && { color: "#fff" }]}>
							Ota Fablab käyttöön
						</Text>
						<Text
							style={[styles.toggleSubtitle, isDark && { color: "#b5b5b5" }]}
						>
							Näytä tai piilota Fablab-välilehti alapalkissa.
						</Text>
					</View>
					<Switch
						value={isEnabled}
						onValueChange={onToggle}
						disabled={isSaving}
						trackColor={{ false: "#aaa", true: "#4A89EE" }}
						thumbColor={isEnabled ? "#ffffff" : "#f4f3f4"}
					/>
				</View>
			</View>

			<InfoItem
				icon="view-week"
				title="Välilehden näkyvyys"
				text="Kun asetus on päällä, Fablab näkyy suoraan alapalkissa. Pois päältä kytkettynä välilehti piilotetaan."
				isDark={isDark}
			/>

			<InfoItem
				icon="memory"
				title="Tallennus"
				text="Valinta tallennetaan laitteelle ja säilyy sovelluksen uudelleenkäynnistyksen jälkeen."
				isDark={isDark}
			/>

			<View
				style={[
					styles.tipBox,
					isDark && { backgroundColor: "#4A89EE10", borderColor: "#4A89EE20" },
				]}
			>
				<Text style={[styles.tipTitle, isDark && { color: "white" }]}>Vinkki:</Text>
				<Text style={[styles.tipText, isDark && { color: "#bedbff" }]}>Jos et näe muutosta heti alapalkissa, palaa kartta- tai minä-välilehteen kerran.</Text>
			</View>
		</ScrollView>
	);
};

export default Fablab;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	toggleCard: {
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#e5e5e5",
		backgroundColor: "#fff",
		padding: 14,
		marginBottom: 8,
	},
	toggleHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	toggleTitle: {
		fontSize: 16,
		fontFamily: "Figtree-SemiBold",
		color: "#333",
		marginBottom: 4,
	},
	toggleSubtitle: {
		fontSize: 14,
		fontFamily: "Figtree-Regular",
		color: "#666",
		lineHeight: 20,
		maxWidth: "90%",
	},
	item: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: "#fff",
		borderRadius: 16,
	},
	iconContainer: {
		backgroundColor: "#EFF4FF",
		width: 40,
		height: 40,
		borderRadius: 12,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 16,
	},
	textContainer: {
		flex: 1,
	},
	title: {
		fontSize: 16,
		fontFamily: "Figtree-SemiBold",
		color: "#333",
		marginBottom: 4,
	},
	text: {
		fontSize: 14,
		fontFamily: "Figtree-Regular",
		color: "#666",
		lineHeight: 20,
	},
	tipBox: {
		backgroundColor: "#F8FAFF",
		borderRadius: 16,
		padding: 16,
		marginTop: 8,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: "#EFF4FF",
	},
	tipTitle: {
		fontFamily: "Figtree-SemiBold",
		color: "#1a1a1a",
		fontSize: 15,
		marginBottom: 6,
	},
	tipText: {
		color: "#4a5568",
		fontSize: 14,
		lineHeight: 20,
		fontFamily: "Figtree-Regular",
	},
});
