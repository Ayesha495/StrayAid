import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdoptForm from "../AdoptForm";
import PledgeForm from "../PledgeForm";
import * as social from "../../../services/socialService";

jest.mock("../../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../../services/socialService", () => ({ applyToAdopt: jest.fn() }));

const s = social as jest.Mocked<typeof social>;
const BANK = { bank: "Meezan Bank", account_name: "Paws & Care Rescue", account_number: "0101-0000000101" };

describe("Adoption form", () => {
  it("walks through the three steps and sends every answer", async () => {
    const onDone = jest.fn();
    s.applyToAdopt.mockResolvedValue({} as never);
    render(<AdoptForm animalId={15} animalName="Luna" defaultName="Ali Raza" onClose={jest.fn()} onDone={onDone} />);

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled(); // phone missing
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: "+92 300 1234567" } });
    fireEvent.click(next);

    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Islamabad" } });
    fireEvent.change(screen.getByLabelText("Do you own or rent?"), { target: { value: "rent" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Yes" })[0]); // landlord allows pets
    fireEvent.change(screen.getByLabelText("People in your home"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Hours alone per day"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Experience with pets"), { target: { value: "some" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Why do you want to adopt Luna?"), { target: { value: "Quiet home, lots of love." } });
    const send = screen.getByRole("button", { name: "Send application" });
    expect(send).toBeDisabled(); // agreements not ticked
    fireEvent.click(screen.getByLabelText(/home visit/));
    fireEvent.click(screen.getByLabelText(/return Luna/));
    expect(send).toBeDisabled(); // data sharing not agreed yet
    fireEvent.click(screen.getByLabelText(/share these answers/));
    fireEvent.click(send);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(s.applyToAdopt).toHaveBeenCalledWith(15, expect.objectContaining({
      full_name: "Ali Raza", phone: "+92 300 1234567", city: "Islamabad", ownership: "rent", landlord_allows_pets: true,
      household_size: 3, hours_alone: 2, experience: "some", agrees_home_visit: true, agrees_return_policy: true,
    }));
  });

  it("shows why the server refused", async () => {
    s.applyToAdopt.mockRejectedValue(new Error("You've already applied to adopt Luna."));
    render(<AdoptForm animalId={15} animalName="Luna" defaultName="Ali Raza" onClose={jest.fn()} onDone={jest.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: "+92 300 1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Lahore" } });
    fireEvent.change(screen.getByLabelText("People in your home"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Hours alone per day"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Experience with pets"), { target: { value: "first_time" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText(/Why do you want/), { target: { value: "Love cats" } });
    fireEvent.click(screen.getByLabelText(/home visit/));
    fireEvent.click(screen.getByLabelText(/return Luna/));
    fireEvent.click(screen.getByLabelText(/share these answers/));
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already applied");
  });
});

describe("Pledge form", () => {
  it("needs a receipt, then sends amount, monthly and receipt", async () => {
    const onSubmit = jest.fn().mockResolvedValue({});
    render(<PledgeForm title="Sponsor Luna" intro="" bank={BANK} allowMonthly onSubmit={onSubmit} onClose={jest.fn()} />);

    expect(screen.getByText("0101-0000000101")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rs 2,500" }));
    fireEvent.click(screen.getByLabelText(/every month/));
    fireEvent.click(screen.getByRole("button", { name: /Send Rs 2,500 receipt/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("transfer receipt");
    expect(onSubmit).not.toHaveBeenCalled();

    const receipt = new File(["x"], "receipt.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Transfer receipt/), { target: { files: [receipt] } });
    fireEvent.click(screen.getByRole("button", { name: /Send Rs 2,500 receipt/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirm the transfer is yours");
    fireEvent.click(screen.getByLabelText(/I made this transfer myself/));
    fireEvent.click(screen.getByRole("button", { name: /Send Rs 2,500 receipt/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent: FormData = onSubmit.mock.calls[0][0];
    expect([sent.get("amount_pkr"), sent.get("monthly"), sent.get("receipt")]).toEqual(["2500", "true", receipt]);
  });

  it("can't be sent when the team has no bank details", () => {
    render(<PledgeForm title="Give" intro="" bank={null} onSubmit={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/hasn't added bank details/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /receipt/ })).toBeDisabled();
  });
});

describe("Form consent", () => {
  it("says who will see an adoption application before it is sent", () => {
    render(<AdoptForm animalId={15} animalName="Luna" defaultName="Ali Raza" onClose={jest.fn()} onDone={jest.fn()} />);
    expect(screen.getByText(/only the rescue team caring for Luna/i)).toBeInTheDocument();
  });

  it("links the donations and refunds policy from the pledge form", () => {
    render(<PledgeForm title="Sponsor Luna" intro="" bank={BANK} onSubmit={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByRole("link", { name: "Donations & Refunds policy" })).toHaveAttribute("href", "/legal/donations");
    expect(screen.getByText(/StrayAid never receives or holds/)).toBeInTheDocument();
  });
});
