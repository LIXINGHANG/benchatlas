(() => {
  const summary = window.BENCHATLAS_DATA?.summary || {};
  const format = value => Number(value || 0).toLocaleString("en-US");
  const values = {
    guideResults: summary.reported_result_count || summary.result_count,
    guideModels: summary.model_count,
    guideBenchmarks: summary.benchmark_family_count,
    guideGroups: summary.benchmark_result_group_count || summary.benchmark_group_count,
    guideComparable: summary.comparable_setup_group_count,
    guideReports: summary.report_count,
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = format(value);
  });
  const familyInline = document.getElementById("guideBenchmarksInline");
  if (familyInline) familyInline.textContent = format(values.guideBenchmarks);
  const resultInline = document.getElementById("guideResultsInline");
  if (resultInline) resultInline.textContent = format(values.guideResults);
})();
