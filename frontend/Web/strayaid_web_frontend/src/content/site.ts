import { CONTACT_EMAIL } from "../appConfig";

/** Who runs StrayAid, shown in the footer and the policies. Keep it true: no invented details. */
export const SITE = {
  name: "StrayAid",
  operator: "the StrayAid project team",
  about: "StrayAid is a final-year Software Engineering (BSSE) project. It is not a registered charity or company.",
  area: "Islamabad and Rawalpindi, Pakistan",
  contactEmail: CONTACT_EMAIL,
  photoCredit: { name: "Pexels", url: "https://www.pexels.com" },
} as const;
