import type { ModelDeployment } from '@sap-ai-sdk/ai-api';
import {
  getFoundationModelDeploymentId,
  getResourceGroup,
} from '@sap-ai-sdk/ai-api/internal.js';
import { OpenApiRequestBuilder } from '@sap-ai-sdk/core';
import type { HttpDestinationOrFetchOptions } from '@sap-cloud-sdk/connectivity';
import type { PredictResponsePayload } from './client/tabpfn/index.ts';
import { TabpfnApi } from './internal.ts';
import type {
  MultipartPayload,
  PredictionData,
  TabpfnRequestOptions,
} from './types.ts';

/**
 * Representation of a TabPFN client to make tabular predictions.
 * @experimental This class is experimental and may change at any time without prior notice.
 */
export class TabpfnClient {
  private modelDeployment: ModelDeployment;
  private destination?: HttpDestinationOrFetchOptions;

  /**
   * Creates an instance of the TabPFN client.
   * @param modelDeployment - This configuration is used to retrieve a deployment. Depending on the configuration use either the given deployment ID or the model name to retrieve matching deployments. If model and deployment ID are given, the model is verified against the deployment.
   * @param destination - The destination to use for the request.
   */
  constructor(
    modelDeployment: ModelDeployment = 'tabpfn-3.5-plus',
    destination?: HttpDestinationOrFetchOptions,
  ) {
    this.modelDeployment = modelDeployment;
    this.destination = destination;
  }

  /**
   * Predict based on inline JSON training and test data.
   * @param predictionData - Labeled training rows and the rows to predict.
   * @param requestConfig - Custom request configuration.
   * @returns Prediction response.
   */
  async predict(
    predictionData: PredictionData,
    requestConfig: TabpfnRequestOptions = {},
  ): Promise<PredictResponsePayload> {
    const { resourceGroup, deploymentId } =
      await this.getResourceGroupAndDeploymentId();

    return TabpfnApi.predict(predictionData)
      .setBasePath(`/inference/deployments/${deploymentId}`)
      .addCustomHeaders({ 'ai-resource-group': resourceGroup || 'default' })
      .addCustomRequestConfiguration(requestConfig)
      .execute(this.destination);
  }

  /**
   * Predict based on CSV or Parquet file uploads.
   * Each dataset is uploaded as a file part; the configuration travels in a text field named `request`.
   * @param payload - File data and prediction configuration to base prediction on.
   * @param requestConfig - Custom request configuration.
   * @returns Prediction response.
   */
  async predictFiles(
    payload: MultipartPayload,
    requestConfig: TabpfnRequestOptions = {},
  ): Promise<PredictResponsePayload> {
    const formData = new FormData();
    formData.append('x_train', toFile(payload.x_train, 'x_train'));
    formData.append('y_train', toFile(payload.y_train, 'y_train'));
    formData.append('x_test', toFile(payload.x_test, 'x_test'));
    formData.append('request', JSON.stringify(payload.request));

    const { resourceGroup, deploymentId } =
      await this.getResourceGroupAndDeploymentId();

    return new OpenApiRequestBuilder<PredictResponsePayload>(
      'post',
      '/predict',
      {
        body: formData,
        headerParameters: { 'content-type': 'multipart/form-data' },
      },
      `/inference/deployments/${deploymentId}`,
    )
      .addCustomHeaders({ 'ai-resource-group': resourceGroup || 'default' })
      .addCustomRequestConfiguration(requestConfig)
      .execute(this.destination);
  }

  /**
   * Gets the resource group and deployment ID for the TabPFN model.
   * @returns Object containing resource group and deployment ID.
   */
  private async getResourceGroupAndDeploymentId() {
    const executableId = 'prior-labs';
    const deploymentId = await getFoundationModelDeploymentId(
      this.modelDeployment,
      executableId,
      this.destination,
    );

    const resourceGroup = getResourceGroup(this.modelDeployment);

    return { resourceGroup, deploymentId };
  }
}

/**
 * Ensures a dataset part is a `File` with a recognizable filename and mimetype.
 * The endpoint accepts CSV or Parquet files; the filename extension and content type are
 * derived from the blob's mimetype. Existing `File` instances are preserved as-is.
 * @param data - The dataset blob or file.
 * @param name - Fallback filename (without extension) used when a plain `Blob` is given.
 * @returns A `File` suitable for multipart upload.
 */
function toFile(data: File | Blob, name: string): File {
  if (data instanceof File) {
    return data;
  }
  const extension = isParquet(data.type) ? '.parquet' : '.csv';
  return new File([data], `${name}${extension}`, { type: data.type });
}

/**
 * Whether the given mimetype refers to a Parquet file.
 * @param mimeType - The mimetype to check.
 * @returns `true` if the mimetype indicates Parquet.
 */
function isParquet(mimeType: string): boolean {
  return mimeType.toLowerCase() === 'application/vnd.apache.parquet';
}
