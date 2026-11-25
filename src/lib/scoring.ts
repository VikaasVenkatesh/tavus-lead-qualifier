import { COMPANY } from "./tavus-config";
import type { QualifyArgs, Qualification, Score } from "./types";

const SERVICE_LABEL: Record<string, string> = {
  no_heat: "No heat",
  ac_repair: "AC repair",
  new_install: "New install",
  maintenance: "Maintenance",
  other: "Other",
};

export const serviceLabel = (s?: string) => (s ? SERVICE_LABEL[s] ?? s : "—");

export function inServiceArea(zip: string) {
  const digits = (zip || "").replace(/\D/g, "");
  return digits.length >= 3 && COMPANY.serviceZips.some((p) => digits.startsWith(p));
}

/**
 * Transparent, rule-based lead scoring. Easy to explain in a demo and easy to swap
 * for a CRM model later. Returns a short reason the PAL can speak back.
 */
export function scoreLead(a: QualifyArgs): Qualification {
  const zipOk = inServiceArea(a.zip);
  if (!zipOk) {
    return {
      score: "cold",
      in_service_area: false,
      priority: "Refer out",
      reason: `ZIP ${a.zip} is outside the KC metro service area.`,
    };
  }

  const emergency = a.urgency === "emergency" || a.service_type === "no_heat";
  const install = a.service_type === "new_install";
  const timeline = (a.timeline || "").toLowerCase();
  const fastTimeline = /(asap|today|tomorrow|this week|week|soon|urgent|flexible)/.test(timeline);
  const commercialish = /(commercial|office|retail)/i.test(a.home_type);

  let points = 0;
  if (emergency) points += 3;
  else if (a.urgency === "soon") points += 2;
  if (install) points += 2; // biggest ticket
  if (install && fastTimeline) points += 1;
  if (a.service_type === "ac_repair") points += 1;
  if (/single|house|home/i.test(a.home_type) || commercialish) points += 1;
  if (a.contact && a.contact.replace(/\D/g, "").length >= 7) points += 1;

  const score: Score = points >= 5 ? "hot" : points >= 3 ? "warm" : "cold";
  const parts = [
    emergency ? "active outage" : a.urgency === "soon" ? "needs help this week" : "flexible timing",
    install ? "high-value install" : serviceLabel(a.service_type).toLowerCase(),
    "in service area",
  ];
  return {
    score,
    in_service_area: true,
    priority: score === "hot" ? "Dispatch today" : score === "warm" ? "Book within 48h" : "Nurture",
    reason: parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".",
  };
}
