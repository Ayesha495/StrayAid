// Post and story categories, as the backend defines them (posts/models.py).

export const POST_CATEGORIES = [
  { value: "medical", label: "Medical update" },
  { value: "adoption", label: "Adoption" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "foster", label: "Foster" },
];

export const POST_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(POST_CATEGORIES.map((item) => [item.value, item.label]));

export const STORY_CATEGORIES = [
  { value: "rescue_update", label: "Rescue Updates" },
  { value: "happy_ending", label: "Happy Endings" },
  { value: "adoption", label: "Adoption" },
  { value: "behind_the_scenes", label: "Behind the Rescue" },
  { value: "sanctuary", label: "Sanctuary" },
];
