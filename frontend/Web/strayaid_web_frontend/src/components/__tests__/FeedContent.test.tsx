import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import FeedContent from "../FeedContent";
import type { Animal, Post } from "../../types/platform";

const mockAnimal: Animal = {
  id: 101,
  name: "Pepper",
  breed: "Mixed",
  description: "Recovering well and ready for cuddles.",
  medical_info: "Vaccinated",
  donation_info: {
    bank: "Meezan Bank",
    account_name: "City Tails Rescue",
    account_number: "1234567890",
  },
  adoption_info: {
    message: "To adopt Pepper, contact City Tails via",
    phone: "0300-0000000",
    email: "citytails@example.com",
  },
  status: "recovering",
  image: "https://example.com/pepper.jpg",
  case: 77,
  case_id: 77,
  organization: {
    id: 1,
    name: "City Tails",
    description: "Rescue group",
    latitude: 24.86,
    longitude: 67.01,
    address: "Karachi",
    phone_number: "0300-0000000",
    contact_email: "citytails@example.com",
  },
  created_at: "2026-04-01T00:00:00Z",
};

const mockPost: Post = {
  id: 501,
  title: "Pepper is doing better",
  content: "Pepper has started eating and is active.",
  image: null,
  created_at: "2026-04-02T00:00:00Z",
  animal: mockAnimal,
  organization: mockAnimal.organization,
};

describe("FeedContent", () => {
  it("shows the animal name on each update card", () => {
    render(
      <MemoryRouter>
        <FeedContent animals={[mockAnimal]} posts={[mockPost]} selectedAnimal={null} onSelectAnimal={jest.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Pepper is doing better")).toBeInTheDocument();
    expect(screen.getByText("Animal:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pepper" })).toHaveAttribute("href", "/animals/101");
  });

  it("opens donation modal for the selected animal", () => {
    const handleSelectAnimal = jest.fn();
    render(
      <MemoryRouter>
        <FeedContent animals={[mockAnimal]} posts={[mockPost]} selectedAnimal={null} onSelectAnimal={handleSelectAnimal} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Donation Info" }));
    expect(handleSelectAnimal).toHaveBeenCalledWith(mockAnimal);
  });
});
