/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
	BatchChangeSet,
	type CreateRequestBuilder,
	type DeleteRequestBuilder,
	type DeSerializers,
	type GetAllRequestBuilder,
	type GetByKeyRequestBuilder,
	ODataBatchRequestBuilder,
	type UpdateRequestBuilder,
} from "@sap-cloud-sdk/odata-v2";
import { transformVariadicArgumentToArray } from "@sap-cloud-sdk/util";
import type {
	CompanyCode,
	CostCenter,
	FinPlanEntryItemVariableFix,
	FinPlanningEntryItem,
	GlAccountInChartOfAccounts,
	ProfitCenter,
} from "./index.js";

/**
 * Batch builder for operations supported on the Api Finplanningentryitem Srv.
 * @param requests The requests of the batch.
 * @returns A request builder for batch.
 */
export function batch<DeSerializersT extends DeSerializers>(
	...requests: Array<
		| ReadApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
		| BatchChangeSet<DeSerializersT>
	>
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
	requests: Array<
		| ReadApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
		| BatchChangeSet<DeSerializersT>
	>,
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
	first:
		| undefined
		| ReadApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
		| BatchChangeSet<DeSerializersT>
		| Array<
				| ReadApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
				| BatchChangeSet<DeSerializersT>
		  >,
	...rest: Array<
		| ReadApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
		| BatchChangeSet<DeSerializersT>
	>
): ODataBatchRequestBuilder<DeSerializersT> {
	return new ODataBatchRequestBuilder(
		defaultApiFinplanningentryitemSrvPath,
		transformVariadicArgumentToArray(first, rest),
	);
}

/**
 * Change set constructor consists of write operations supported on the Api Finplanningentryitem Srv.
 * @param requests The requests of the change set.
 * @returns A change set for batch.
 */
export function changeset<DeSerializersT extends DeSerializers>(
	...requests: Array<
		WriteApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
	>
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
	requests: Array<
		WriteApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
	>,
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
	first:
		| undefined
		| WriteApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>
		| Array<WriteApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>>,
	...rest: Array<WriteApiFinplanningentryitemSrvRequestBuilder<DeSerializersT>>
): BatchChangeSet<DeSerializersT> {
	return new BatchChangeSet(transformVariadicArgumentToArray(first, rest));
}

export const defaultApiFinplanningentryitemSrvPath =
	"/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV";
export type ReadApiFinplanningentryitemSrvRequestBuilder<
	DeSerializersT extends DeSerializers,
> =
	| GetAllRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
	| GetAllRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
	| GetAllRequestBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
	  >
	| GetAllRequestBuilder<FinPlanningEntryItem<DeSerializersT>, DeSerializersT>
	| GetAllRequestBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
	  >
	| GetAllRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
	| GetByKeyRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
	| GetByKeyRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
	| GetByKeyRequestBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
	  >
	| GetByKeyRequestBuilder<FinPlanningEntryItem<DeSerializersT>, DeSerializersT>
	| GetByKeyRequestBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
	  >
	| GetByKeyRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>;
export type WriteApiFinplanningentryitemSrvRequestBuilder<
	DeSerializersT extends DeSerializers,
> =
	| CreateRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
	| UpdateRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
	| DeleteRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
	| CreateRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
	| UpdateRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
	| DeleteRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
	| CreateRequestBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
	  >
	| UpdateRequestBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
	  >
	| DeleteRequestBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
	  >
	| CreateRequestBuilder<FinPlanningEntryItem<DeSerializersT>, DeSerializersT>
	| UpdateRequestBuilder<FinPlanningEntryItem<DeSerializersT>, DeSerializersT>
	| DeleteRequestBuilder<FinPlanningEntryItem<DeSerializersT>, DeSerializersT>
	| CreateRequestBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
	  >
	| UpdateRequestBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
	  >
	| DeleteRequestBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
	  >
	| CreateRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
	| UpdateRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
	| DeleteRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>;
