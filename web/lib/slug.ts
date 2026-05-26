import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";

const adjectives = [
  "swift", "bright", "calm", "clever", "quiet", "bold", "gentle", "warm", "cool", "sharp",
  "smart", "keen", "grand", "epic", "pure", "agile", "jolly", "lucky", "brave", "kind",
  "neat", "fine", "happy", "glad", "soft", "fast", "wild", "tame", "proud", "lively",
  "wise", "fair", "free", "merry", "sleek", "fancy", "super", "prime", "cosmic", "solar",
  "lunar", "magic", "vocal", "sound", "tuned", "clear", "fresh", "crisp", "light", "dreamy"
];

const nouns = [
  "panda", "koala", "tiger", "lion", "eagle", "hawk", "falcon", "owl", "wolf", "fox",
  "bear", "deer", "otter", "seal", "shark", "crane", "swan", "robin", "lark", "raven",
  "lynx", "beaver", "rabbit", "hare", "ferret", "lemur", "gecko", "turtle", "squid", "whale",
  "river", "ocean", "forest", "mountain", "valley", "meadow", "desert", "island", "garden", "cloud",
  "storm", "breeze", "shadow", "spark", "flame", "stone", "pebble", "wave", "harbor", "haven"
];

const verbs = [
  "leap", "soar", "glide", "dash", "bound", "pounce", "stride", "march", "zoom", "flash",
  "glow", "shine", "bloom", "sprout", "grow", "rise", "climb", "dive", "swim", "float",
  "drift", "sail", "fly", "wing", "hover", "spin", "whirl", "dance", "sing", "hum",
  "buzz", "chirp", "roar", "howl", "growl", "bark", "purr", "meow", "play", "skip",
  "hop", "jump", "run", "walk", "step", "look", "gaze", "seek", "find", "meet"
];

export function generateMeetingSlug(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  return `${adj}-${noun}-${verb}`;
}

export async function generateUniqueSlug(): Promise<string> {
  let slug = generateMeetingSlug();
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const existing = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      exists = false;
    } else {
      slug = generateMeetingSlug();
      attempts++;
    }
  }

  if (exists) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  return slug;
}
