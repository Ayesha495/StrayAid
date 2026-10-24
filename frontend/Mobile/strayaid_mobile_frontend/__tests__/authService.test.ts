import { deleteAccount, loginWithGoogleAccessToken, registerUser, SignUpError } from "../services/authService";
import { saveToken } from "../utils/tokenStorage";

jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("../services/notificationService", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(null),
  sendPushTokenToBackend: jest.fn(),
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const reply = (status: number, body: object) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => fetchMock.mockReset());

describe("sign-up", () => {
  const data = { fullName: " Hira Khan ", email: " hira@x.pk ", password: "Rescue!Pass2026", rePassword: "Rescue!Pass2026", acceptTerms: true };

  it("sends the acceptance of the terms with the account details", async () => {
    fetchMock.mockReturnValue(reply(201, { id: 1, email: "hira@x.pk" }));
    await registerUser(data);
    const form: FormData = fetchMock.mock.calls[0][1].body;
    expect(form.get("accept_terms")).toBe("true");
    expect(form.get("full_name")).toBe("Hira Khan");
    expect(form.get("email")).toBe("hira@x.pk");
  });

  it("refuses to send anything until the terms are accepted", async () => {
    await expect(registerUser({ ...data, acceptTerms: false })).rejects.toThrow(/Terms of Service/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps server errors to the right field", async () => {
    fetchMock.mockReturnValue(reply(400, { email: ["An account with this email already exists."] }));
    const error = await registerUser(data).catch((caught) => caught);
    expect(error).toBeInstanceOf(SignUpError);
    expect(error.fields.email).toBe("An account with this email already exists.");
  });

  it("explains a dropped connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(registerUser(data)).rejects.toThrow(/connection/);
  });
});

describe("Continue with Google", () => {
  it("tells the server the terms were accepted", async () => {
    fetchMock.mockReturnValue(reply(200, { access: "a", refresh: "r", user: { email: "g@x.pk" } }));
    await loginWithGoogleAccessToken("ya29.token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ access_token: "ya29.token", accept_terms: true });
  });

  it("shows the server's reason when Google sign-in is refused", async () => {
    fetchMock.mockReturnValue(reply(403, { detail: "This account has been deleted." }));
    await expect(loginWithGoogleAccessToken("ya29.token")).rejects.toThrow("This account has been deleted.");
  });

  it("explains a dropped connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(loginWithGoogleAccessToken("ya29.token")).rejects.toThrow(/connection/);
  });
});

describe("delete account", () => {
  beforeEach(() => saveToken("access-token"));

  it("asks the server to delete the signed-in account", async () => {
    fetchMock.mockReturnValue(reply(204, {}));
    await deleteAccount("my-password");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/me\/$/);
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    expect(JSON.parse(init.body)).toEqual({ confirm: "DELETE", password: "my-password" });
  });

  it("shows why the server refused", async () => {
    fetchMock.mockReturnValue(reply(400, { detail: "That password isn't right." }));
    await expect(deleteAccount("wrong")).rejects.toThrow("That password isn't right.");
  });
});
