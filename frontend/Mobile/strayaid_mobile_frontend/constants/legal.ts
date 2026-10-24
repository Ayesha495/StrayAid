// StrayAid's policies. Shared word for word with the website (src/content/legal.ts there);
// __tests__/legal.test.ts fails if the two drift apart. The volunteer guidelines are app-only.

export type PolicyKey = "terms" | "privacy" | "cookies" | "donations" | "delete-account";
export type LegalDocKey = PolicyKey | "guidelines";

export type LegalDoc = {
  title: string;
  updated: string;
  summary: string;
  sections: { heading: string; body: string }[];
};

export const POLICY_ORDER: PolicyKey[] = ["terms", "privacy", "cookies", "donations", "delete-account"];

const UPDATED = "24 October 2026";

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: {
    title: "Terms of Service",
    updated: UPDATED,
    summary: "The rules for using StrayAid on the web and in the mobile app.",
    sections: [
      {
        heading: "Who runs StrayAid",
        body:
          "StrayAid is a final-year Software Engineering (BSSE) project run by the StrayAid project team. It is not a registered charity or company. It connects people who spot stray or injured animals with rescue organizations in Islamabad and Rawalpindi.",
      },
      {
        heading: "What StrayAid is and isn't",
        body:
          "StrayAid is a coordination tool. Reporters share photos and locations; each rescue organization decides which cases it can take on. StrayAid does not provide veterinary, transport or emergency services, and cannot promise that every report will be answered.",
      },
      {
        heading: "Who can use it",
        body:
          "You must be at least 13 years old to create an account, and anyone under 18 needs a parent or guardian's permission. Give accurate details, keep your password private, and don't share your account. You are responsible for what is posted from it.",
      },
      {
        heading: "Reports, photos and posts",
        body:
          "Only report real animals that need help, using photos you took yourself. Don't post false reports, other people's personal details, or abusive, violent, hateful or misleading content. Photos are checked automatically to make sure they show an animal, and organizations may decline any case. By posting, you allow StrayAid to show your photos and text inside the service so rescuers and the community can see them. You keep ownership of what you post.",
      },
      {
        heading: "Rescue organizations",
        body:
          "Anyone registering an organization must be allowed to act for it and must give true details. StrayAid does not verify organizations or their bank details, so check before you give money or hand over an animal. Organizations are responsible for the animals in their care, their adoption decisions and the money they receive.",
      },
      {
        heading: "Adoptions and sponsorships",
        body:
          "Adoption applications and sponsorship receipts go to the organization caring for the animal, which makes its own decisions. StrayAid never receives or holds money; see the Donations & Refunds policy.",
      },
      {
        heading: "Safety",
        body:
          "Never put yourself in danger to reach an animal. If an animal or a person is in immediate danger, contact local emergency services first.",
      },
      {
        heading: "Ending your account",
        body:
          "You can delete your account at any time from Settings; the Delete your account page explains what is removed and what is kept. We may suspend accounts that break these terms.",
      },
      {
        heading: "No warranty",
        body:
          "StrayAid is a student project offered free of charge and as it is. We try to keep it running and accurate, but it may be unavailable, slow or wrong at times, and we can't be held responsible for what organizations, reporters or adopters do.",
      },
      {
        heading: "Law and changes",
        body:
          "These terms are governed by the laws of Pakistan. We may update them as StrayAid develops; if a change is significant we'll tell you in the app before it takes effect. Questions? Use the contact details at the bottom of this page.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED,
    summary: "What StrayAid collects, why, who sees it, and how to remove it.",
    sections: [
      {
        heading: "Who is responsible",
        body:
          "The StrayAid project team runs StrayAid and decides how your data is used. Contact details are at the bottom of this page.",
      },
      {
        heading: "What we collect",
        body:
          "Account: your name, email address, a password (stored only as a secure hash) and an optional profile photo, phone number and area. Reports: the photos, description, severity and map location you send. Activity: follows, likes, saved posts, comments, chat messages, adoption applications and sponsorship pledges with their receipt images. Phone app only: a push-notification token, your location while you are choosing a spot on the map, and the spot you pick for Urgent Radius Alerts if you turn them on. We do not collect contacts, browsing history or advertising IDs.",
      },
      {
        heading: "Why we use it",
        body:
          "To run your account, pass your reports to rescue organizations, show animals and posts, send updates about rescues you follow, let organizations review your applications and pledges, and keep the community safe. We don't sell your data, share it with advertisers, or use it to profile you.",
      },
      {
        heading: "Who can see what",
        body:
          "Your name and profile photo appear next to your comments and public activity. Report photos, descriptions and locations are shown to organizations, on the public rescue map and on the case page, with your first name only. An adoption application or sponsorship receipt is seen only by the organization it is sent to. Your email address and phone number are never shown publicly; organizations see your phone number only when you give it in an application or turn on Emergency Field Readiness.",
      },
      {
        heading: "Services that help run StrayAid",
        body:
          "Google, only if you choose Continue with Google. Expo, to deliver push notifications. OpenStreetMap, which provides the map pictures and so sees the address of the device loading them. Gmail, to send password reset codes. The hosting provider that runs our server and database. Photos are checked for animals on our own server, not by an outside AI service.",
      },
      {
        heading: "How long we keep it",
        body:
          "Your data stays while your account is open. When you delete your account, your personal details are removed straight away; reports and sponsorship records stay without your name so rescues and organizations' accounts aren't broken. Server logs with IP addresses are kept only as long as our host keeps them, normally a few weeks.",
      },
      {
        heading: "Keeping it safe",
        body:
          "Everything travels over HTTPS, passwords are hashed, sign-in attempts are rate-limited, and uploaded files get random names so they can't be guessed. No system is perfectly secure, so please use a password you don't use anywhere else.",
      },
      {
        heading: "Your choices and rights",
        body:
          "You can see and edit your details in Settings, turn notifications off on your phone, and delete your account at any time. To get a copy of your data or correct something you can't change yourself, contact us and we'll reply within 30 days.",
      },
      {
        heading: "Children",
        body: "StrayAid is not meant for children under 13, and we don't knowingly collect their data. If you think a child has an account, contact us and we'll remove it.",
      },
      {
        heading: "Changes",
        body: "If we change how we use your data, we'll update this page and tell you in the app before the change takes effect.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: UPDATED,
    summary: "StrayAid keeps you signed in and nothing else. There are no advertising or analytics cookies.",
    sections: [
      {
        heading: "What StrayAid stores in your browser",
        body:
          "When you sign in on the website, your browser's local storage keeps your sign-in tokens and basic profile so you stay signed in between pages. This is strictly necessary for the site to work and is removed when you log out. StrayAid sets no advertising or analytics cookies and uses no tracking pixels.",
      },
      {
        heading: "Other services",
        body:
          "If you choose Continue with Google, Google's sign-in window may set its own cookies, covered by Google's privacy policy. Map pictures come from OpenStreetMap, which sets no cookies but sees your device's address when the map loads. Fonts are served by StrayAid itself.",
      },
      {
        heading: "Why there is no cookie banner",
        body:
          "A consent banner is needed for optional cookies such as analytics or advertising. StrayAid only stores what is needed to keep you signed in, so there is nothing optional to accept or refuse. If we ever add optional cookies, we'll ask first.",
      },
      {
        heading: "The mobile app",
        body:
          "The phone app uses no cookies. It keeps your sign-in tokens in the phone's secure storage and a draft of an unsent report in the app's own storage.",
      },
      {
        heading: "Clearing it",
        body: "Log out, or clear this site's data in your browser settings. You'll need to sign in again afterwards.",
      },
    ],
  },
  donations: {
    title: "Donations & Refunds",
    updated: UPDATED,
    summary: "How sponsorships and gifts work, and who to ask for a refund.",
    sections: [
      {
        heading: "StrayAid never handles your money",
        body:
          "StrayAid never receives or holds money and charges no fees. When you sponsor an animal or give to a shelter, you transfer the money yourself, straight to the bank account the organization shows on its page, then upload your receipt so the organization can match it.",
      },
      {
        heading: "Confirmation",
        body:
          "A pledge shows as pending until the organization checks its account and confirms it. Only confirmed pledges count towards an animal's funding bar. An organization can mark a pledge as not received if the transfer never arrived.",
      },
      {
        heading: "Monthly sponsorships",
        body:
          "A monthly sponsorship is a promise, not an automatic payment: nothing is ever taken from your account. Each month you transfer again if you want to; you can stop at any time simply by not sending the next transfer.",
      },
      {
        heading: "Refunds",
        body:
          "Because the money goes straight to the organization, only the organization can refund it. Message them from their page in StrayAid and explain what went wrong. StrayAid can't reverse bank transfers, but if an organization doesn't respond or you think money is being misused, tell us and we'll look into it and may hide the organization.",
      },
      {
        heading: "Before you give",
        body:
          "StrayAid does not verify organizations or their bank details. Check the account name matches the organization, start small if you are unsure, and keep your receipt. Tax receipts, if any, come from the organization, not StrayAid.",
      },
    ],
  },
  "delete-account": {
    title: "Delete your account",
    updated: UPDATED,
    summary: "How to delete your StrayAid account and data, and what happens to it.",
    sections: [
      {
        heading: "How to delete it",
        body:
          "Website: sign in, open Settings and choose Delete account. Phone app: open Profile, then Settings, then Delete account. Type DELETE and your password to confirm (accounts made with Google only need DELETE). It happens straight away and can't be undone.",
      },
      {
        heading: "If you can't sign in",
        body:
          "Reset your password from the sign-in page first. If that doesn't work, email us from the address on your account using the contact details at the bottom of this page, and we'll delete it within 30 days.",
      },
      {
        heading: "What is deleted",
        body:
          "Your name, email, phone and photo, your area and alert location, your follows, likes, saved posts, notifications and push tokens. Pending adoption applications are withdrawn and the personal details in all your applications are removed. You are signed out everywhere and the account can't be used again; you can sign up with the same email later.",
      },
      {
        heading: "What is kept, without your name",
        body:
          "Animal reports and case history stay, so rescues already under way aren't interrupted. Sponsorship records stay so organizations can keep their accounts straight. Comments and chat messages stay in their conversations, shown as from a Deleted user.",
      },
      {
        heading: "Organization accounts",
        body:
          "Deleting an organization's account hides the organization from the public and stops new cases reaching it. Its animals and posts stay for the people who adopted or sponsored them.",
      },
    ],
  },
  guidelines: {
    title: "Volunteer Guidelines & FAQ",
    updated: UPDATED,
    summary: "How to report safely and what happens next.",
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
