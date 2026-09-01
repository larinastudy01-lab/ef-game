import { getTrainingRoute } from "./GameMenuPage";

describe("getTrainingRoute", () => {
  test.each([
    ["srt", "/training-srt"],
    ["ssg", "/training-ssg"],
    ["pm", "/training-picture-memory"],
    ["cbt", "/training-cbt"],
    ["dccs", "/training-dccs"],
    ["lb", "/training-linking-balloons"],
  ])("routes %s stages to their own training page", (gameId, expectedRoute) => {
    expect(getTrainingRoute({ gameId, trainPath: "/training-cbt" })).toBe(expectedRoute);
  });

  test("supports legacy stages that only contain a short task name", () => {
    expect(getTrainingRoute({ shortName: "PM" })).toBe("/training-picture-memory");
  });
});
