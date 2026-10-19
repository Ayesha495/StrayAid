import type { AppNotification } from "../types/api";

/** Where a notification should take you, by what it's about and who you are. */
export function notificationLink(notification: AppNotification, isOrganization: boolean): string | null {
  const data = notification.data ?? {};
  const id = (key: string) => (data[key] === undefined || data[key] === null ? null : String(data[key]));

  switch (data.type) {
    case "chat_message":
      return id("conversation_id") ? `/messages/${id("conversation_id")}` : "/messages";
    case "adoption_application":
    case "application":
    case "adoption_withdrawn":
      return isOrganization ? `/applications${id("application_id") ? `?application=${id("application_id")}` : ""}` : "/my-applications";
    case "adoption_decision":
      return "/my-applications";
    case "sponsorship":
    case "sponsor":
    case "shelter_donation":
      return isOrganization ? "/funds" : "/my-applications";
    case "case":
    case "case_status":
    case "case_note":
    case "critical_case":
    case "rescue":
      if (!id("case_id")) return isOrganization ? "/cases" : "/my-reports";
      return isOrganization ? `/cases/${id("case_id")}` : `/case/${id("case_id")}`;
    case "post_comment":
    case "new_post":
    case "post":
      return id("post_id") ? `/feed?post=${id("post_id")}` : "/feed";
    case "animal":
    case "animal_status":
    case "animal_update":
      return id("animal_id") ? `/animals/${id("animal_id")}` : null;
    default:
      return null;
  }
}
