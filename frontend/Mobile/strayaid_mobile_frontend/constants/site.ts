// Who runs StrayAid, shown under every policy. Same facts as the website's src/content/site.ts.
export const SITE = {
  name: "StrayAid",
  operator: "the StrayAid project team",
  about: "StrayAid is a final-year Software Engineering (BSSE) project. It is not a registered charity or company.",
  contactEmail: process.env.EXPO_PUBLIC_CONTACT_EMAIL?.trim() ?? "",
} as const;
