import { fireEvent, screen, waitFor } from "@testing-library/react";
import AnimalRecord from "../AnimalRecord";
import { ORG_USER, renderPage } from "../../test/render";
import { ORGANIZATION } from "../../test/fixtures";
import * as platform from "../../services/platformService";
import * as funding from "../../services/fundingService";
import * as notifications from "../../services/notificationService";
import type { Animal, MedicalRecord, ReadinessItem } from "../../types/platform";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/platformService", () => ({
  getAnimal: jest.fn(),
  getAnimalPosts: jest.fn(),
  getAnimalHistory: jest.fn(),
  getMedicalRecords: jest.fn(),
  updateAnimal: jest.fn(),
  createMedicalRecord: jest.fn(),
  updateMedicalRecord: jest.fn(),
  deleteMedicalRecord: jest.fn(),
  createAnimal: jest.fn(),
  getOrganizationProfile: jest.fn(),
}));
jest.mock("../../services/fundingService", () => ({ getAnimalApplications: jest.fn() }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn() }));

const p = platform as jest.Mocked<typeof platform>;

const checklist = (done: Partial<Record<string, boolean>> = {}): ReadinessItem[] => [
  { key: "photo", label: "Photo added", done: done.photo ?? true, required: true },
  { key: "description", label: "Public description written", done: done.description ?? true, required: true },
  { key: "health", label: "Health recorded and treatment finished", done: done.health ?? true, required: true },
  { key: "vaccinated", label: "Vaccinated", done: done.vaccinated ?? false, required: false },
  { key: "sterilized", label: "Spayed or neutered", done: done.sterilized ?? false, required: false },
];

const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: 15, name: "Sunny", species: "Dog", breed: "Desi", description: "Shy at first.", medical_info: "", donation_info: null, adoption_info: null,
  status: "recovering", image: null, case: 23, case_id: 23, organization: ORGANIZATION, created_at: "2026-10-01T00:00:00Z",
  health: "under_treatment", age: 0, readiness: checklist({ health: false }), next_care: null, ...overrides,
});

const entry = (overrides: Partial<MedicalRecord> = {}): MedicalRecord => ({
  id: 1, animal: 15, kind: "vaccination", kind_label: "Vaccination", title: "Rabies vaccine", date: "2026-10-05", next_due: null,
  vet: "Dr Sana", weight_kg: "12.50", notes: "", is_public: true, created_at: "2026-10-05T00:00:00Z", ...overrides,
});

const open = () => renderPage(<AnimalRecord />, { user: ORG_USER, path: "/animals/:animalId/manage", route: "/animals/15/manage" });

describe("Animal record", () => {
  beforeEach(() => {
    p.getOrganizationProfile.mockResolvedValue(ORGANIZATION);
    p.getAnimalPosts.mockResolvedValue([]);
    p.getAnimalHistory.mockResolvedValue([]);
    (funding.getAnimalApplications as jest.Mock).mockResolvedValue([]);
    (notifications.getUnreadCounts as jest.Mock).mockResolvedValue({ notifications: 0, messages: 0 });
  });

  it("keeps adoption closed until the required checklist is done", async () => {
    p.getAnimal.mockResolvedValue(animal());
    p.getMedicalRecords.mockResolvedValue([]);
    open();

    expect(await screen.findByRole("heading", { name: "Sunny", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Under 1 year/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Open for adoption" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Health recorded and treatment finished" })).toBeInTheDocument();
  });

  it("asks why before closing a record, and saves the note with the move", async () => {
    p.getAnimal.mockResolvedValue(animal({ readiness: checklist() }));
    p.getMedicalRecords.mockResolvedValue([]);
    p.updateAnimal.mockResolvedValue(animal({ status: "deceased" }));
    open();

    fireEvent.click(await screen.findByRole("button", { name: "Passed away" }));
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/What happened\?/), { target: { value: "Kidney failure." } });
    fireEvent.click(confirm);

    await waitFor(() => expect(p.updateAnimal).toHaveBeenCalledWith(15, { status: "deceased", status_note: "Kidney failure." }));
  });

  it("shows the medical history with weight and offers to record a due follow-up", async () => {
    p.getAnimal.mockResolvedValue(animal());
    p.getMedicalRecords.mockResolvedValue([entry({ next_due: "2027-10-05" }), entry({ id: 2, kind: "checkup", kind_label: "Check-up", title: "Intake exam", is_public: false, weight_kg: null })]);
    open();

    expect(await screen.findByText("Intake exam")).toBeInTheDocument();
    expect(screen.getByText(/Team only/)).toBeInTheDocument();
    expect(screen.getByText("12.5 kg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Record it" }));
    expect(screen.getByLabelText("What was done")).toHaveValue("Rabies vaccine");
    expect(screen.getByLabelText("Type")).toHaveValue("vaccination");
  });

  it("tells another team's visitors to use the public profile", async () => {
    p.getAnimal.mockResolvedValue(animal({ readiness: undefined }));
    p.getMedicalRecords.mockResolvedValue([]);
    open();

    expect(await screen.findByRole("heading", { name: /cared for by another team/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open public profile" })).toHaveAttribute("href", "/animals/15");
  });
});
