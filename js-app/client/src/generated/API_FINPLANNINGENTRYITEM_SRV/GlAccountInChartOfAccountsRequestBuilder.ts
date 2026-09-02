/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
	type DefaultDeSerializers,
	type DeSerializers,
	type DeserializedType,
	GetAllRequestBuilder,
	GetByKeyRequestBuilder,
	RequestBuilder,
} from "@sap-cloud-sdk/odata-v2";
import type { GlAccountInChartOfAccounts } from "./GlAccountInChartOfAccounts.js";

/**
 * Request builder class for operations supported on the {@link GlAccountInChartOfAccounts} entity.
 */
export class GlAccountInChartOfAccountsRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<GlAccountInChartOfAccounts<T>, T> {
	/**
	 * Returns a request builder for querying all `GlAccountInChartOfAccounts` entities.
	 * @returns A request builder for creating requests to retrieve all `GlAccountInChartOfAccounts` entities.
	 */
	getAll(): GetAllRequestBuilder<GlAccountInChartOfAccounts<T>, T> {
		return new GetAllRequestBuilder<GlAccountInChartOfAccounts<T>, T>(
			this.entityApi,
		);
	}

	/**
	 * Returns a request builder for retrieving one `GlAccountInChartOfAccounts` entity based on its keys.
	 * @param chartOfAccounts Key property. See {@link GlAccountInChartOfAccounts.chartOfAccounts}.
	 * @param glAccount Key property. See {@link GlAccountInChartOfAccounts.glAccount}.
	 * @returns A request builder for creating requests to retrieve one `GlAccountInChartOfAccounts` entity based on its keys.
	 */
	getByKey(
		chartOfAccounts: DeserializedType<T, "Edm.String">,
		glAccount: DeserializedType<T, "Edm.String">,
	): GetByKeyRequestBuilder<GlAccountInChartOfAccounts<T>, T> {
		return new GetByKeyRequestBuilder<GlAccountInChartOfAccounts<T>, T>(
			this.entityApi,
			{
				ChartOfAccounts: chartOfAccounts,
				GLAccount: glAccount,
			},
		);
	}
}
