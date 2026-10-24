import API from "../api/axios";

export interface MyProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar: string | null;
  area: string;
  phone: string;
  member_since: string;
}

export const getMyProfile = async () => (await API.get<MyProfile>("/auth/me/profile/")).data;

/** Name, phone, area and avatar (multipart when a new photo is attached). */
export const updateMyProfile = async (data: FormData) => (await API.patch<MyProfile>("/auth/me/profile/", data)).data;

export const changePassword = async (current_password: string, new_password: string) => {
  await API.post("/auth/users/set_password/", { current_password, new_password });
};

/** Delete the signed-in account (Settings → Delete account). Google-only accounts send no password. */
export const deleteAccount = async (password: string) => {
  await API.delete("/auth/me/", { data: { confirm: "DELETE", password } });
};
