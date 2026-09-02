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
import { Moment } from "moment";
import type { ProfitCenter } from "./ProfitCenter.js";

/**
 * Request builder class for operations supported on the {@link ProfitCenter} entity.
 */
export class ProfitCenterRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<ProfitCenter<T>, T> {
	/**
	 * Returns a request builder for querying all `ProfitCenter` entities.
	 * @returns A request builder for creating requests to retrieve all `ProfitCenter` entities.
	 */
	getAll(): GetAllRequestBuilder<ProfitCenter<T>, T> {
		return new GetAllRequestBuilder<ProfitCenter<T>, T>(this.entityApi);
	}

	/**
	 * Returns a request builder for retrieving one `ProfitCenter` entity based on its keys.
	 * @param controllingArea Key property. See {@link ProfitCenter.controllingArea}.
	 * @param profitCenter Key property. See {@link ProfitCenter.profitCenter}.
	 * @param validityEndDate Key property. See {@link ProfitCenter.validityEndDate}.
	 * @returns A request builder for creating requests to retrieve one `ProfitCenter` entity based on its keys.
	 */
	getByKey(
		controllingArea: DeserializedType<T, "Edm.String">,
		profitCenter: DeserializedType<T, "Edm.String">,
		validityEndDate: DeserializedType<T, "Edm.DateTime">,
	): GetByKeyRequestBuilder<ProfitCenter<T>, T> {
		return new GetByKeyRequestBuilder<ProfitCenter<T>, T>(this.entityApi, {
			ControllingArea: controllingArea,
			ProfitCenter: profitCenter,
			ValidityEndDate: validityEndDate,
		});
	}
}
