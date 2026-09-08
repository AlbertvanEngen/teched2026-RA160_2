package com.sap.teched.demo.tool;

import static com.sap.ai.sdk.foundationmodels.rpt.RptModel.SAP_RPT_1_5;
import static com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig.TaskTypeEnum.REGRESSION;

import com.sap.ai.sdk.foundationmodels.rpt.RptClient;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.ColumnType;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.ExplanationConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.Prediction;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictRequestPayloadOneOf;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictResponsePayload;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionPlaceholder;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.RowsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.SchemaFieldConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig;
import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.dto.ForecastDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * Agent tool: forecastTabular.
 *
 * <p>Produces a forward-looking prediction using the SAP RPT (Tabular AI) 1.5 model. The agent
 * supplies known historical data points plus the future period to predict. RPT fills in the
 * {@code [PREDICT]} placeholder value from context.
 */
@Component
@Slf4j
public class ForecastTool {

  private static final String PLACEHOLDER = "[PREDICT]";
  private static final String COL_PERIOD = "PERIOD";
  private static final String COL_COSTCENTER = "COSTCENTER";
  private static final String COL_VALUE = "VALUE";

  /**
   * A single historical observation supplied by the agent from previous tool results.
   *
   * @param period the period, e.g. "2024-Q1"
   * @param value the observed numeric value for that period
   */
  public record HistoricalPoint(String period, double value) {}

  /**
   * Predict a future cost or budget value for a cost center using SAP RPT Tabular AI.
   *
   * @param costCenter the cost center the prediction is for
   * @param metric what is being predicted, either "cost" or "budget"
   * @param targetPeriod the future period to predict, e.g. "2025-Q1"
   * @param history known historical data points (at least two) to learn from
   * @return the prediction outcome
   */
  @Tool(
      description =
          "Predict a FUTURE cost or budget value for a cost center using SAP RPT Tabular AI. "
              + "Only use for forward-looking questions (e.g. 'next quarter', 'next year'). "
              + "First load historical data with query_financial_planning or query_journal_entry, "
              + "then fetch it with query_duckdb to build the history list. "
              + "Provide at least two historical data points.")
  public ForecastDto forecastTabular(
      @ToolParam(description = "cost center, e.g. IT") final String costCenter,
      @ToolParam(description = "what to predict: 'cost' or 'budget'") final String metric,
      @ToolParam(description = "future period to predict, e.g. 2025-Q1") final String targetPeriod,
      @ToolParam(description = "known historical data points (period + value pairs)")
          final List<HistoricalPoint> history) {

    final Map<String, Object> args =
        Map.of(
            "costCenter", costCenter,
            "metric", metric,
            "targetPeriod", targetPeriod,
            "history", history);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("forecastTabular", args) : null;

    final List<Map<String, RowsInnerValue>> rows = new ArrayList<>();
    for (final HistoricalPoint point : history) {
      final Map<String, RowsInnerValue> row = new LinkedHashMap<>();
      row.put(COL_COSTCENTER, RowsInnerValue.create(costCenter));
      row.put(COL_PERIOD, RowsInnerValue.create(point.period()));
      row.put(COL_VALUE, RowsInnerValue.create(BigDecimal.valueOf(point.value())));
      rows.add(row);
    }
    final Map<String, RowsInnerValue> target = new LinkedHashMap<>();
    target.put(COL_COSTCENTER, RowsInnerValue.create(costCenter));
    target.put(COL_PERIOD, RowsInnerValue.create(targetPeriod));
    target.put(COL_VALUE, RowsInnerValue.create(PLACEHOLDER));
    rows.add(target);

    final Map<String, SchemaFieldConfig> schema =
        Map.of(
            COL_COSTCENTER, SchemaFieldConfig.create().dtype(ColumnType.STRING),
            COL_PERIOD, SchemaFieldConfig.create().dtype(ColumnType.STRING),
            COL_VALUE, SchemaFieldConfig.create().dtype(ColumnType.NUMERIC));

    final var targetColumns =
        List.of(
            TargetColumnConfig.create()
                .name(COL_VALUE)
                .predictionPlaceholder(PredictionPlaceholder.create(PLACEHOLDER))
                .taskType(REGRESSION));

    final var predictionConfig =
        PredictionConfig.create()
            .targetColumns(targetColumns)
            .explanations(ExplanationConfig.create().topColumnScores(3).topRelevantContextRows(3));

    final var request =
        PredictRequestPayloadOneOf.create()
            .predictionConfig(predictionConfig)
            .rows(rows)
            .dataSchema(schema)
            .parseDataTypes(true);

    final PredictResponsePayload response = RptClient.forModel(SAP_RPT_1_5).tableCompletion(request);

    final String predicted = extractPrediction(response);
    final String explanation = extractExplanation(response);

    final ForecastDto dto = new ForecastDto(costCenter, targetPeriod, metric, predicted, "EUR", explanation);

    final String summary = "SAP RPT 1.5 predicted " + metric + " for " + costCenter + " in " + targetPeriod + ".";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "forecastTabular", args, summary, dto);
    }

    return dto;
  }

  private static String extractPrediction(final PredictResponsePayload response) {
    final PredictionsInnerValue value = response.getPredictions().get(0).get(COL_VALUE);
    if (value instanceof PredictionsInnerValue.ListOfPredictionResults list) {
      final Prediction prediction = list.values().get(0).getPrediction();
      if (prediction instanceof Prediction.InnerBigDecimal n) {
        return n.value().toPlainString();
      }
      if (prediction instanceof Prediction.InnerString s) {
        return s.value();
      }
    }
    return String.valueOf(value);
  }

  private static String extractExplanation(final PredictResponsePayload response) {
    final var explanation = response.getExplanations();
    if (explanation == null) {
      return null;
    }
    final var sb = new StringBuilder();
    if (explanation.getTopColumnScores() != null && !explanation.getTopColumnScores().isEmpty()) {
      sb.append("Top drivers: ").append(explanation.getTopColumnScores().get(0));
    }
    if (explanation.getTopRelevantContextRows() != null
        && !explanation.getTopRelevantContextRows().isEmpty()) {
      if (sb.length() > 0) sb.append("; ");
      sb.append("Most relevant history: ").append(explanation.getTopRelevantContextRows().get(0));
    }
    return sb.length() > 0 ? sb.toString() : null;
  }
}
