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
import type { FinPlanningEntryItem } from "./FinPlanningEntryItem.js";

/**
 * Request builder class for operations supported on the {@link FinPlanningEntryItem} entity.
 */
export class FinPlanningEntryItemRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<FinPlanningEntryItem<T>, T> {
	/**
	 * Returns a request builder for querying all `FinPlanningEntryItem` entities.
	 * @returns A request builder for creating requests to retrieve all `FinPlanningEntryItem` entities.
	 */
	getAll(): GetAllRequestBuilder<FinPlanningEntryItem<T>, T> {
		return new GetAllRequestBuilder<FinPlanningEntryItem<T>, T>(this.entityApi);
	}

	/**
	 * Returns a request builder for retrieving one `FinPlanningEntryItem` entity based on its keys.
	 * @param id Key property. See {@link FinPlanningEntryItem.id}.
	 * @returns A request builder for creating requests to retrieve one `FinPlanningEntryItem` entity based on its keys.
	 */
	getByKey(
		id: DeserializedType<T, "Edm.String">,
	): GetByKeyRequestBuilder<FinPlanningEntryItem<T>, T> {
		return new GetByKeyRequestBuilder<FinPlanningEntryItem<T>, T>(
			this.entityApi,
			{ ID: id },
		);
	}
}
