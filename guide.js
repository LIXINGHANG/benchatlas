(() => {
  const summary = window.BENCHATLAS_DATA?.summary || {};
  const format = value => Number(value || 0).toLocaleString("en-US");
  const values = {
    guideResults: summary.result_count,
    guideModels: summary.model_count,
    guideBenchmarks: summary.map_benchmark_group_count || summary.benchmark_group_count,
    guideReports: summary.report_count,
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = format(value);
  });
})();
