// Terms of Service and Privacy Policy shown from the sign-up screen (Stitch 6).
// Plain language, and limited to what StrayAid actually does with data.

export type LegalDoc = {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

export const LEGAL_DOCS: Record<"terms" | "privacy", LegalDoc> = {
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
};
