export type CanteenMenuMeal = {
  name: string;
  diets: string[];
};

export type CanteenMenuSection = {
  title: string;
  meals: CanteenMenuMeal[];
};

export type CanteenDayMenu = {
  date: string;
  sections: CanteenMenuSection[];
};

type CompassMeal = {
  name?: unknown;
  diets?: unknown;
};

type CompassPackage = {
  sortOrder?: unknown;
  name?: unknown;
  meals?: unknown;
};

type CompassMenu = {
  date?: unknown;
  menuPackages?: unknown;
};

type CompassInitialMenu = {
  weekMenu?: { menus?: unknown };
};

const INITIAL_MENU_MARKER = "window.__INITIAL_MENU__ = ";
const SCHOOL_PACKAGE_SORT_ORDERS = new Set([1, 72, 80]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function extractCompassInitialMenu(html: string): CompassInitialMenu {
  const markerIndex = html.indexOf(INITIAL_MENU_MARKER);
  if (markerIndex < 0) throw new Error("Ruokalistan dataa ei löytynyt.");
  const jsonStart = markerIndex + INITIAL_MENU_MARKER.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(html.slice(jsonStart, index + 1)) as CompassInitialMenu;
      }
    }
  }
  throw new Error("Ruokalistan data oli virheellinen.");
}

function normalizePackage(
  value: CompassPackage,
  index: number
): CanteenMenuSection | null {
  const meals = Array.isArray(value.meals)
    ? (value.meals as CompassMeal[]).flatMap((meal) => {
        const name = clean(meal.name);
        if (!name) return [];
        return [{
          name,
          diets: Array.isArray(meal.diets)
            ? meal.diets.map(clean).filter(Boolean)
            : [],
        }];
      })
    : [];
  if (!meals.length) return null;

  const sortOrder = Number(value.sortOrder);
  const suppliedTitle = clean(value.name);
  const title = suppliedTitle ||
    (sortOrder === 72
      ? "Kasvislounas"
      : sortOrder === 80
        ? "Lounas"
        : `Linjasto ${index + 1}`);
  return { title, meals };
}

export function selectOtaniemiSchoolMenu(
  initialMenu: CompassInitialMenu,
  date: string
): CanteenDayMenu | null {
  const menus = Array.isArray(initialMenu.weekMenu?.menus)
    ? (initialMenu.weekMenu?.menus as CompassMenu[])
    : [];
  const day = menus.find((menu) => clean(menu.date).slice(0, 10) === date);
  if (!day || !Array.isArray(day.menuPackages)) return null;

  const schoolPackages = (day.menuPackages as CompassPackage[]).filter((item) => {
    const title = clean(item.name).toLocaleLowerCase("fi-FI");
    return title.includes("otaniemen lukion") ||
      SCHOOL_PACKAGE_SORT_ORDERS.has(Number(item.sortOrder));
  });
  const sections = schoolPackages.flatMap((item, index) => {
    const section = normalizePackage(item, index);
    return section ? [section] : [];
  });
  return sections.length ? { date, sections } : null;
}
