import football from "@/assets/icons/football.png";
import rugby from "@/assets/icons/rugby.png";
import climbing from "@/assets/icons/climbing.png";
import volleyball from "@/assets/icons/volleyball.png";
import basketball from "@/assets/icons/basketball.png";
import running from "@/assets/icons/running.png";
import swimming from "@/assets/icons/swimming.png";
import tennis from "@/assets/icons/tennis.png";
import spark from "@/assets/icons/spark.png";

export const AVATAR_ICONS = {
  spark: { src: spark, label: "Spark" },
  football: { src: football, label: "Football" },
  rugby: { src: rugby, label: "Rugby" },
  climbing: { src: climbing, label: "Climbing" },
  volleyball: { src: volleyball, label: "Volleyball" },
  basketball: { src: basketball, label: "Basketball" },
  running: { src: running, label: "Running" },
  swimming: { src: swimming, label: "Swimming" },
  tennis: { src: tennis, label: "Tennis" },
} as const;

export type AvatarKey = keyof typeof AVATAR_ICONS;

export function getAvatar(key?: string | null) {
  const k = (key && key in AVATAR_ICONS ? key : "spark") as AvatarKey;
  return AVATAR_ICONS[k];
}
