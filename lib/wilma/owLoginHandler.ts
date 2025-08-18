import * as SecureStore from "expo-secure-store";

export type WilmaLoginResponse = {
	token: string;
	reset: boolean;
	[key: string]: any;
};

const TOKEN_KEY = "wilma_token";
const USERNAME_KEY = "wilma_username";
const LOGIN_TIME_KEY = "wilma_login_time";

/**
 * Wilma login handler for Otawilma API
 * Usage: await wilmaLogin(username, password)
 */
export async function wilmaLogin(username: string, password: string): Promise<WilmaLoginResponse> {
	const url = "https://wilma.otawilma.fi/api/login";
	const headers = {
		"User-Agent": "OtaMaps app",
		"Accept": "*/*",
		"Accept-Language": "en-US,en;q=0.5",
		"Accept-Encoding": "gzip, deflate, br, zstd",
		"Content-Type": "application/json",
		"Connection": "keep-alive",
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-site",
		"Sec-GPC": "1",
		"Priority": "u=0",
		"TE": "trailers",
	};
	const body = JSON.stringify({ username, password });
	const response = await fetch(url, {
		method: "POST",
		headers,
		body,
		// credentials: "include", // Uncomment if cookies/session needed
	});
	if (!response.ok) {
		throw new Error(`Wilma login failed: ${response.status} ${response.statusText}`);
	}
	let data: WilmaLoginResponse;
	try {
		data = await response.json();
	} catch {
		throw new Error("Wilma login: invalid response format");
	}
	// Save token, username, login time securely
	if (data.token) {
		await SecureStore.setItemAsync(TOKEN_KEY, data.token);
		await SecureStore.setItemAsync(USERNAME_KEY, username);
		await SecureStore.setItemAsync(LOGIN_TIME_KEY, String(Date.now()));
	}
	return data;
}

export async function getWilmaToken(): Promise<string | null> {
	return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getWilmaUsername(): Promise<string | null> {
	return await SecureStore.getItemAsync(USERNAME_KEY);
}

export async function getWilmaLoginTime(): Promise<number | null> {
	const t = await SecureStore.getItemAsync(LOGIN_TIME_KEY);
	return t ? Number(t) : null;
}

export async function clearWilmaLogin() {
	await SecureStore.deleteItemAsync(TOKEN_KEY);
	await SecureStore.deleteItemAsync(USERNAME_KEY);
	await SecureStore.deleteItemAsync(LOGIN_TIME_KEY);
}