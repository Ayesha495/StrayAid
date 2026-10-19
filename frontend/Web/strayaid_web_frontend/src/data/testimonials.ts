// Landing page testimonials.
// PLACEHOLDER CONTENT: these quotes are written to match the demo accounts in
// seed_demo_data.py so the section can be designed and demoed. Replace them with real,
// consented quotes from users before StrayAid goes live.

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  tone: "green" | "coral" | "amber" | "blue";
  /** A real photo of the kind of animal the story is about (not the person). */
  image: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I'd walked past injured dogs before and felt awful that I didn't know who to call. With StrayAid I took one photo, and twenty minutes later a rescue team messaged me that they were on their way.",
    name: "Zainab Qureshi",
    role: "Reported an injured dog in F-10",
    image: "/landing/curb.webp",
    tone: "coral",
  },
  {
    quote:
      "We followed Luna's recovery for weeks, from the first update to the day she was ready. Adopting her felt like the happy ending of a story we'd been part of all along.",
    name: "Sara Ahmed",
    role: "Adopted Luna",
    image: "/landing/street-cat.webp",
    tone: "green",
  },
  {
    quote:
      "The rescue board shows us the most urgent cases first, so our small team spends its time where it matters. Receipts for sponsorships are in one place instead of ten WhatsApp chats.",
    name: "Paws & Care Rescue",
    role: "Rescue team, Islamabad",
    image: "/landing/rescued.webp",
    tone: "blue",
  },
  {
    quote:
      "I can't foster, but I can sponsor. Seeing exactly how much Sunny's treatment needs, and watching the bar fill up, makes a small monthly gift feel like it really counts.",
    name: "Bilal Hussain",
    role: "Monthly sponsor",
    image: "/landing/kitten.webp",
    tone: "amber",
  },
];
