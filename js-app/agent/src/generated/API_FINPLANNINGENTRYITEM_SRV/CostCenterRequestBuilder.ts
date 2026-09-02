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
import type { CostCenter } from "./CostCenter.ts";

/**
 * Request builder class for operations supported on the {@link CostCenter} entity.
 */
export class CostCenterRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<CostCenter<T>, T> {
	/**
	 * Returns a request builder for querying all `CostCenter` entities.
	 * @returns A request builder for creating requests to retrieve all `CostCenter` entities.
	 */
	getAll(): GetAllRequestBuilder<CostCenter<T>, T> {
		return new GetAllRequestBuilder<CostCenter<T>, T>(this.entityApi);
	}

	/**
	 * Returns a request builder for retrieving one `CostCenter` entity based on its keys.
	 * @param controllingArea Key property. See {@link CostCenter.controllingArea}.
	 * @param costCenter Key property. See {@link CostCenter.costCenter}.
	 * @param validityEndDate Key property. See {@link CostCenter.validityEndDate}.
	 * @returns A request builder for creating requests to retrieve one `CostCenter` entity based on its keys.
	 */
	getByKey(
		controllingArea: DeserializedType<T, "Edm.String">,
		costCenter: DeserializedType<T, "Edm.String">,
		validityEndDate: DeserializedType<T, "Edm.DateTime">,
	): GetByKeyRequestBuilder<CostCenter<T>, T> {
		return new GetByKeyRequestBuilder<CostCenter<T>, T>(this.entityApi, {
			ControllingArea: controllingArea,
			CostCenter: costCenter,
			ValidityEndDate: validityEndDate,
		});
	}
}
