import countries from "i18n-iso-countries";

// Codes GADM uses that aren't officially-assigned ISO 3166-1 alpha-3 codes,
// so the library doesn't know them. Kosovo (XKO) is the one case seen so far.
const NON_ISO_OVERRIDES = {
    XKO: "XK",
};

// GADM assigns placeholder codes (Z01..Z09) to disputed border areas; show the
// flag of the administering / claiming country instead.
const DISPUTED_TERRITORY_PARENT = {
    Z01: "IND", Z02: "CHN", Z03: "CHN", Z04: "IND", Z05: "IND",
    Z06: "PAK", Z07: "IND", Z08: "CHN", Z09: "IND",
};

// Resolve a GID_0 (ISO3) code to a lowercase ISO 3166-1 alpha-2 code, or null.
export const gidToAlpha2 = (gid0) => {
    if (!gid0) return null;
    const code = String(gid0).trim().toUpperCase();
    const iso3 = DISPUTED_TERRITORY_PARENT[code] ?? code;
    const alpha2 = NON_ISO_OVERRIDES[iso3] ?? countries.alpha3ToAlpha2(iso3);
    return alpha2 ? alpha2.toLowerCase() : null;
};

// flagcdn.com SVG flag URL for a GID_0 code, or null if unknown.
export const flagImageUrlFromGid = (gid0) => {
    const alpha2 = gidToAlpha2(gid0);
    return alpha2 ? `https://flagcdn.com/${alpha2}.svg` : null;
};

// Regional-indicator flag emoji (e.g. "us" -> 🇺🇸) for a GID_0 code, or null.
export const flagEmojiFromGid = (gid0) => {
    const alpha2 = gidToAlpha2(gid0);
    if (!alpha2) return null;
    return alpha2
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
};
