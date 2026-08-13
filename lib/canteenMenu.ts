import {
  extractCompassInitialMenu,
  selectOtaniemiSchoolMenu,
  type CanteenDayMenu,
} from "./canteenMenuCore";

export const OTANIEMI_MENU_URL =
  "https://www.compass-group.fi/ravintolat-ja-ruokalistat/amica/kaupungit/espoo/espoon-tietokyla/";

function helsinkiDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function fetchOtaniemiMenu(
  date = new Date()
): Promise<CanteenDayMenu | null> {
  const response = await fetch(OTANIEMI_MENU_URL, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`Ruokalistan lataus epäonnistui (HTTP ${response.status}).`);
  }
  const initialMenu = extractCompassInitialMenu(await response.text());
  return selectOtaniemiSchoolMenu(initialMenu, helsinkiDate(date));
}

