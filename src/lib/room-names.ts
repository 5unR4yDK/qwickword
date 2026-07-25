// Friendly two-word room slugs — "quiet-otter", "brave-heron" — instead of
// opaque random strings, so the shared link reads like something a person
// would happily paste into a chat. Uniqueness only matters among rooms that
// currently exist (rooms are single-use and expire), so two words is plenty
// of namespace; the caller retries with a fresh slug on a name collision.

const ADJECTIVES = [
  "able", "agile", "amber", "ample", "artful", "autumn", "azure", "bold",
  "brave", "breezy", "bright", "brisk", "calm", "candid", "cheery", "chill",
  "civil", "clever", "cosy", "crisp", "curious", "daring", "dapper", "deft",
  "eager", "early", "easy", "fabled", "fair", "fleet", "fluent", "fond",
  "frank", "free", "fresh", "gentle", "glad", "golden", "graceful", "grand",
  "happy", "hardy", "hearty", "honest", "humble", "jolly", "keen", "kind",
  "lively", "lucid", "lucky", "mellow", "merry", "mighty", "modest", "neat",
  "nimble", "noble", "novel", "patient", "peppy", "perky", "plucky", "polite",
  "proud", "quick", "quiet", "rapid", "ready", "regal", "robust", "rosy",
  "sage", "sharp", "shiny", "silent", "sincere", "sleek", "smart", "smooth",
  "snappy", "solid", "spry", "stable", "steady", "stellar", "sunny", "swift",
  "tidy", "true", "trusty", "upbeat", "vivid", "warm", "wise", "witty",
  "zesty", "zippy",
] as const;

const ANIMALS = [
  "badger", "bear", "beaver", "bison", "bobcat", "camel", "cheetah", "civet",
  "condor", "cougar", "coyote", "crane", "cricket", "curlew", "deer",
  "dolphin", "dove", "eagle", "egret", "elk", "ermine", "falcon", "ferret",
  "finch", "fox", "gazelle", "gecko", "gibbon", "giraffe", "grouse", "gull",
  "hare", "hawk", "hedgehog", "heron", "hound", "ibex", "ibis", "iguana",
  "jackal", "jaguar", "jay", "kestrel", "kite", "koala", "lark", "lemur",
  "leopard", "linnet", "lion", "llama", "lynx", "macaw", "magpie", "marmot",
  "marten", "meerkat", "mink", "mole", "moose", "narwhal", "newt", "ocelot",
  "orca", "oriole", "osprey", "otter", "owl", "panda", "panther", "parrot",
  "pelican", "penguin", "pika", "plover", "puffin", "puma", "quail", "rabbit",
  "raven", "robin", "seal", "serval", "shrew", "sparrow", "stoat", "stork",
  "swan", "swift", "tapir", "teal", "tern", "tiger", "toucan", "vole",
  "walrus", "weasel", "wombat", "wren", "zebra",
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** A fresh "adjective-animal" slug, e.g. "quiet-otter". */
export function generateRoomSlug(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}`;
}
