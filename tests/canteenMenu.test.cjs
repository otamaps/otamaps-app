const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractCompassInitialMenu,
  selectOtaniemiSchoolMenu,
} = require("../.expo/canteen-test-build/canteenMenuCore.js");

const payload = {
  weekMenu: {
    menus: [{
      date: "2026-08-13T00:00:00",
      menuPackages: [
        { sortOrder: 38, name: "Tietokylä", meals: [{ name: "Muu ruoka" }] },
        { sortOrder: 72, name: "", meals: [{ name: " Soija-  makaronilaatikkoa ", diets: ["A", "L"] }] },
        { sortOrder: 80, name: "", meals: [{ name: "Jauheliha-makaronilaatikkoa", diets: ["A"] }] },
      ],
    }],
  },
};

test("extracts Compass initial menu JSON from the official page", () => {
  const html = `<script>${"window.__INITIAL_MENU__ = "}${JSON.stringify(payload)};</script>`;
  assert.deepEqual(extractCompassInitialMenu(html), payload);
});

test("keeps only Otaniemen school lunch packages", () => {
  assert.deepEqual(selectOtaniemiSchoolMenu(payload, "2026-08-13"), {
    date: "2026-08-13",
    sections: [
      { title: "Kasvislounas", meals: [{ name: "Soija- makaronilaatikkoa", diets: ["A", "L"] }] },
      { title: "Lounas", meals: [{ name: "Jauheliha-makaronilaatikkoa", diets: ["A"] }] },
    ],
  });
});

test("returns null when the school has no menu for the day", () => {
  assert.equal(selectOtaniemiSchoolMenu(payload, "2026-08-14"), null);
});
