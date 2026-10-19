// Terms of Service and Privacy Policy shown from the sign-up screen (Stitch 6), and the
// volunteer guidelines linked from the Profile screen.
// Plain language, and limited to what StrayAid actually does with data.

export type LegalDoc = {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

export type LegalDocKey = "terms" | "privacy" | "guidelines";

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: {
    title: "Terms of Service",
    updated: "October 2026",
    sections: [
      {
        heading: "What StrayAid is",
        body:
          "StrayAid connects people who spot stray or injured animals with rescue organizations. Reporters share photos and locations; organizations decide which cases they can take on. StrayAid is a coordination tool and does not provide veterinary or emergency services itself.",
      },
      {
        heading: "Your account",
        body:
          "You need an account to report animals, follow rescues, comment, chat, adopt or sponsor. Keep your password private and give accurate details. You are responsible for what is posted from your account.",
      },
      {
        heading: "Reports and posts",
        body:
          "Only report real animals that need help, with your own photos. Don't post false reports, other people's personal details, or abusive, violent or misleading content. Reports may be checked automatically and flagged if they look invalid, and organizations may decline any case.",
      },
      {
        heading: "Adoptions and sponsorships",
        body:
          "Adoption applications and sponsorship receipts are reviewed by the organization caring for the animal. Each organization makes its own decisions, and StrayAid does not process payments.",
      },
      {
        heading: "Safety",
        body:
          "Never put yourself in danger to reach an animal. If an animal or person is in immediate danger, contact local emergency services first.",
      },
      {
        heading: "Ending your account",
        body:
          "You can delete your account at any time from Settings. We may suspend accounts that break these terms. Reports you have made stay on the cases they belong to so rescues are not interrupted.",
      },
      {
        heading: "Changes",
        body:
          "We may update these terms as StrayAid develops. If the changes are significant, we'll tell you in the app before they take effect.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "October 2026",
    sections: [
      {
        heading: "What we collect",
        body:
          "Your name, email address and optional profile photo when you sign up. When you report an animal: the photos, description and location you submit. We also keep the follows, likes, comments, messages and applications you make in the app.",
      },
      {
        heading: "How we use it",
        body:
          "To run your account, show your reports to rescue organizations, send you updates about animals and cases you follow, and keep the community safe. We don't sell your data or use it for advertising.",
      },
      {
        heading: "Location",
        body:
          "Location is only used when you report an animal, so rescuers can find it. Report locations are shown to organizations and on the rescue map.",
      },
      {
        heading: "Who can see what",
        body:
          "Your name and profile photo appear next to your comments and public activity. Organizations see the details of reports you send them and applications you make to them. Your email address is never shown publicly.",
      },
      {
        heading: "Notifications and email",
        body:
          "With your permission we send push notifications about rescues you follow. We email you only for account matters such as password reset codes.",
      },
      {
        heading: "Your choices",
        body:
          "You can edit your profile, change notification settings, or delete your account in Settings. Deleting your account removes your name and email; reports linked to rescue cases are kept without them.",
      },
      {
        heading: "Contact",
        body: "Questions about your data? Reach the StrayAid team through Settings → About and help.",
      },
    ],
  },
  guidelines: {
    title: "Volunteer Guidelines & FAQ",
    updated: "October 2026",
    sections: [
      {
        heading: "Your safety comes first",
        body:
          "Never put yourself in danger to reach an animal. Stay off busy roads, keep a safe distance from animals that growl, bite or run, and don't try to catch an injured animal with bare hands. Report it and let the rescue team handle it.",
      },
      {
        heading: "Making a good report",
        body:
          "Take a clear photo from a safe distance with the whole animal in view. Drop the pin where the animal is, not where you are standing, and describe what you saw: injuries, behaviour, and how long it has been there. Reports with a clear photo are checked faster.",
      },
      {
        heading: "While you wait",
        body:
          "If it's safe, stay nearby until the team arrives, keep children and other animals away, and offer water in a shallow bowl. Don't give human food or medicine. You can follow the case and chat with the organization from the case page.",
      },
      {
        heading: "Emergency Field Readiness",
        body:
          "Turning this on tells rescue teams you are happy to be called to check on a case near you. They see your phone number only when they contact you about a case. Turn it off any time from your profile.",
      },
      {
        heading: "Urgent Radius Alerts",
        body:
          "Get a notification when someone reports a critical case within 5 km of the spot you choose. The alert shows the area, never the reporter's details.",
      },
      {
        heading: "Adopting and sponsoring",
        body:
          "Adoption applications go straight to the organization caring for the animal, who may call you or visit your home. Sponsorships are bank transfers to the organization; attach your receipt so they can confirm it.",
      },
      {
        heading: "Points, levels and badges",
        body:
          "You earn points for reports (more when the rescue team acts on them), adoptions, confirmed pledges and supportive comments. Levels go Helper, Hero, Guardian, Champion and Legend. Reports flagged as invalid don't earn points.",
      },
    ],
  },
};
