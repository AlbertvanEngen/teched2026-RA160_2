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
import type { FinPlanEntryItemVariableFix } from "./FinPlanEntryItemVariableFix.js";

/**
 * Request builder class for operations supported on the {@link FinPlanEntryItemVariableFix} entity.
 */
export class FinPlanEntryItemVariableFixRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<FinPlanEntryItemVariableFix<T>, T> {
	/**
	 * Returns a request builder for querying all `FinPlanEntryItemVariableFix` entities.
	 * @returns A request builder for creating requests to retrieve all `FinPlanEntryItemVariableFix` entities.
	 */
	getAll(): GetAllRequestBuilder<FinPlanEntryItemVariableFix<T>, T> {
		return new GetAllRequestBuilder<FinPlanEntryItemVariableFix<T>, T>(
			this.entityApi,
		);
	}

	/**
	 * Returns a request builder for retrieving one `FinPlanEntryItemVariableFix` entity based on its keys.
	 * @param id Key property. See {@link FinPlanEntryItemVariableFix.id}.
	 * @returns A request builder for creating requests to retrieve one `FinPlanEntryItemVariableFix` entity based on its keys.
	 */
	getByKey(
		id: DeserializedType<T, "Edm.String">,
	): GetByKeyRequestBuilder<FinPlanEntryItemVariableFix<T>, T> {
		return new GetByKeyRequestBuilder<FinPlanEntryItemVariableFix<T>, T>(
			this.entityApi,
			{ ID: id },
		);
	}
}
