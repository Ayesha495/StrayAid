import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../ui/Toast";
import { ShellProvider } from "../layout/ShellContext";
import type { CurrentUser } from "../types/authTypes";

export const ORG_USER: CurrentUser = {
  id: 22,
  email: "paws-care@strayaid.local",
  username: "paws_care",
  first_name: "",
  last_name: "",
  role: "organization",
};

export const REPORTER_USER: CurrentUser = {
  id: 26,
  email: "ali.raza@strayaid.local",
  username: "ali",
  first_name: "Ali",
  last_name: "Raza",
  role: "public",
};

/** Renders a page as a signed-in user, inside the router and the app's providers. */
export function renderPage(
  ui: ReactElement,
  { user = ORG_USER, path = "/", route = "/" }: { user?: CurrentUser | null; path?: string; route?: string } = {},
) {
  localStorage.clear();
  if (user) {
    localStorage.setItem("access", "test-token");
    localStorage.setItem("currentUser", JSON.stringify(user));
  }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <ShellProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<div>Other page</div>} />
          </Routes>
        </ShellProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
