export function cleanPreferences(input, owned = []) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid preferences.");
  const p = {};
  for (const key of [
    "compact",
    "lite",
    "motion",
    "homeRecent",
    "homeFavorites",
  ])
    if (key in input) {
      if (typeof input[key] !== "boolean") throw Error("Invalid " + key);
      p[key] = input[key];
    }
  for (const [key, max] of [
    ["title", 80],
    ["notes", 10000],
  ])
    if (key in input) {
      if (typeof input[key] !== "string" || input[key].length > max)
        throw Error("Invalid " + key);
      p[key] = input[key];
    }
  for (const key of ["favorites", "recent", "watchlist"])
    if (key in input) {
      if (
        !Array.isArray(input[key]) ||
        input[key].length > 200 ||
        input[key].some((v) => typeof v !== "string" || v.length > 100)
      )
        throw Error("Invalid " + key);
      p[key] = [...new Set(input[key])];
    }
  if ("theme" in input) {
    if (!["navy", ...owned].includes(input.theme))
      throw Error("Unlock that theme first.");
    p.theme = input.theme;
  }
  if ("wallpaper" in input) {
    if (!["still", "reactive", "grid", "black"].includes(input.wallpaper))
      throw Error("Invalid wallpaper.");
    p.wallpaper = input.wallpaper;
  }
  for (const [key, max] of [
    ["glass", 100],
    ["roundness", 24],
  ])
    if (key in input) {
      if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > max)
        throw Error("Invalid " + key);
      p[key] = input[key];
    }
  return p;
}
