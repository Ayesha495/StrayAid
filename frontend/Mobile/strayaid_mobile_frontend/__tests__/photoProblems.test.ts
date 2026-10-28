import { ApiError, PhotoCheckTimeout } from "../services/mobileContentService";
import { describePhotoProblem } from "../utils/photoProblems";

// The report screen used to show every failed photo check as a connection problem. Each
// cause now gets its own explanation and the right fix.

describe("describePhotoProblem", () => {
  it("asks for a new photo when no animal was found", () => {
    const problem = describePhotoProblem(new ApiError("No animal", 422, "not_an_animal"));
    expect(problem.kind).toBe("not_an_animal");
    expect(problem.fix).toBe("photo");
  });

  it("passes on the server's reason for an unusable file", () => {
    const problem = describePhotoProblem(new ApiError("Choose a photo smaller than 10 MB.", 400, "invalid_image"));
    expect(problem).toMatchObject({ kind: "unusable_photo", fix: "photo", message: "Choose a photo smaller than 10 MB." });
    expect(describePhotoProblem(new ApiError("x", 400, "unreadable_image")).kind).toBe("unusable_photo");
  });

  it("doesn't blame the connection when the photo checker is unavailable", () => {
    const problem = describePhotoProblem(new ApiError("Can't check", 503, "detector_unavailable"));
    expect(problem.kind).toBe("checker_unavailable");
    expect(problem.fix).toBe("retry");
    expect(problem.message).toMatch(/internet is fine/i);
  });

  it("tells a dead connection apart from an unreachable server and a slow upload", () => {
    expect(describePhotoProblem(new TypeError("Network request failed")).kind).toBe("no_connection");
    expect(describePhotoProblem(new ApiError("Backend not reachable", 502, null)).kind).toBe("server_unreachable");
    expect(describePhotoProblem(new PhotoCheckTimeout()).kind).toBe("too_slow");
  });

  it("calls anything else a problem on StrayAid's side", () => {
    expect(describePhotoProblem(new ApiError("Boom", 500, null)).kind).toBe("server_error");
  });

  it("always gives next steps", () => {
    const errors = [new ApiError("x", 422, "not_an_animal"), new TypeError("Network request failed"), new ApiError("x", 500, null)];
    errors.forEach((error) => expect(describePhotoProblem(error).steps.length).toBeGreaterThan(0));
  });
});
