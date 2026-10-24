import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import LegalScreen from "../app/legal/[doc]";
import { LEGAL_DOCS, POLICY_ORDER } from "../constants/legal";
import { unlabelledTappables } from "../test/a11y";

const openDoc = (doc: string) => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ doc });
  return render(<LegalScreen />);
};

describe("Policy screen", () => {
  it.each([...POLICY_ORDER, "guidelines" as const])("shows %s with every section", (key) => {
    openDoc(key);
    expect(screen.getByRole("header", { name: LEGAL_DOCS[key].title })).toBeTruthy();
    for (const section of LEGAL_DOCS[key].sections) expect(screen.getByText(section.heading)).toBeTruthy();
  });

  it("falls back to the terms for an unknown policy", () => {
    openDoc("nonsense");
    expect(screen.getByRole("header", { name: "Terms of Service" })).toBeTruthy();
  });

  it("links to the other policies", () => {
    openDoc("privacy");
    fireEvent.press(screen.getByRole("link", { name: "Cookie Policy" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "cookies" } });
  });

  it("labels everything a screen reader can tap", () => {
    openDoc("terms");
    expect(unlabelledTappables(screen.UNSAFE_root)).toEqual([]);
  });
});
