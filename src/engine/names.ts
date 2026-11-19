/**
 * Seeded fantasy place names. Names are short enough to fit on a province label
 * and unique within a map. The same seed always produces the same names.
 */
const STARTS = ["Al", "Bel", "Cor", "Dar", "El", "Fen", "Gal", "Har", "Ist", "Kel", "Lor", "Mar", "Nor", "Os", "Pel", "Quen", "Ros", "Sal", "Tor", "Ul", "Val", "Wyn", "Yr", "Zan", "Bran", "Cal", "Dun", "Ess", "Thal", "Vor", "Ash", "Brin", "Cael", "Dor", "Eld", "Gor", "Hal", "Ith", "Kar", "Lun", "Mor", "Ned", "Ort", "Rav", "Sev", "Tam", "Ver", "Wes"];
const MIDDLES = ["", "", "", "a", "e", "i", "o", "an", "ar", "en", "el", "or", "is", "un"];
const PROVINCE_ENDS = ["dor", "mar", "wick", "ford", "ven", "mere", "gard", "ton", "ros", "dale", "more", "reth", "vale", "burn", "lin", "oth", "rin", "stead", "moor", "fell", "crest", "ham", "gate", "wood"];
const COUNTRY_ENDS = ["ia", "ar", "or", "enne", "ost", "and", "ica", "eth", "ium", "aris", "oria", "heim"];
const ISLAND_ENDS = ["holm", "sey", "ey", "skar", "rock", "cay", "isle", "reef"];

const MAX_LABEL = 9;

function capitalise(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function createNameGenerator(next: () => number) {
  const used = new Set<string>();
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)];
  function unique(build: () => string, maxLength: number, fallback: string): string {
    for (let attempt = 0; attempt < 60; attempt++) {
      const name = capitalise(build());
      if (name.length >= 4 && name.length <= maxLength && !used.has(name)) { used.add(name); return name; }
    }
    // Practically unreachable, but keeps names unique for any configuration.
    let index = 2;
    while (used.has(`${fallback} ${index}`)) index++;
    used.add(`${fallback} ${index}`);
    return `${fallback} ${index}`;
  }
  return {
    country: () => unique(() => pick(STARTS) + pick(MIDDLES) + pick(COUNTRY_ENDS), 10, "Realm"),
    province: () => unique(() => pick(STARTS) + pick(MIDDLES.slice(0, 8)) + pick(PROVINCE_ENDS), MAX_LABEL, "March"),
    island: () => unique(() => pick(STARTS) + pick(ISLAND_ENDS), MAX_LABEL, "Isle"),
  };
}
