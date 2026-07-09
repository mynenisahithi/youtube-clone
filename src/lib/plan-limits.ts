export type PlanTier = "free" | "bronze" | "silver" | "gold";

export const PLANS: Record<PlanTier, { name: string; price: number; limitSec: number; downloads: string; features: string[] }> = {
  free:   { name: "Free",   price: 0,   limitSec: 5 * 60,   downloads: "1 / day",   features: ["5 minute watch limit", "1 download / day", "Ad-supported"] },
  bronze: { name: "Bronze", price: 10,  limitSec: 7 * 60,   downloads: "1 / day",   features: ["7 minute watch limit", "1 download / day", "Fewer ads"] },
  silver: { name: "Silver", price: 50,  limitSec: 10 * 60,  downloads: "Unlimited", features: ["10 minute watch limit", "Unlimited downloads", "No ads"] },
  gold:   { name: "Gold",   price: 100, limitSec: Infinity, downloads: "Unlimited", features: ["Unlimited watch time", "Unlimited downloads", "No ads", "Priority support"] },
};

export const canDownload = (plan: PlanTier, todayCount: number) =>
  plan === "silver" || plan === "gold" ? true : todayCount < 1;
