// One report for every StrayAid test suite. Each suite writes JUnit XML into results/, and
// Allure turns that into the charts. Run `npm run report` here to rebuild it.
export default {
  name: "StrayAid Test Report",
  output: "./report",
  historyPath: "./history.jsonl",
  plugins: {
    awesome: {
      options: {
        reportName: "StrayAid Test Report",
        groupBy: ["parentSuite", "suite"],
      },
    },
    dashboard: {
      options: {
        reportName: "StrayAid Test Dashboard",
      },
    },
  },
};
