import { render, screen } from "@testing-library/react";
import FundingMeter from "../FundingMeter";

describe("Funding meter", () => {
  it("shows raised, goal, percent and what's left", () => {
    render(<FundingMeter raised={1500} goal={15000} caption="raised for Luna's care" supporters={1} />);
    expect(screen.getByText("Rs 1,500")).toBeInTheDocument();
    expect(screen.getByText("raised for Luna's care of Rs 15,000")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("1 supporter")).toBeInTheDocument();
    expect(screen.getByText("Rs 13,500 to go")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Rs 1,500 of Rs 15,000, 10%");
  });

  it("celebrates a met goal and caps the bar at 100%", () => {
    render(<FundingMeter raised={20000} goal={15000} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Goal reached, thank you!")).toBeInTheDocument();
  });

  it("says when no goal is set", () => {
    render(<FundingMeter raised={500} goal={0} />);
    expect(screen.getByText("No funding goal set yet.")).toBeInTheDocument();
  });
});
