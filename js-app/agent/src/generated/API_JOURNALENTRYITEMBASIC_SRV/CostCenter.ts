/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
	type DefaultDeSerializers,
	type DeSerializers,
	type DeserializedType,
	Entity,
} from "@sap-cloud-sdk/odata-v2";
import type { CostCenterApi } from "./CostCenterApi.ts";

/**
 * This class represents the entity "A_CostCenter" of service "API_JOURNALENTRYITEMBASIC_SRV".
 */
export class CostCenter<T extends DeSerializers = DefaultDeSerializers>
	extends Entity
	implements CostCenterType<T>
{
	/**
	 * Technical entity name for CostCenter.
	 */
	static override _entityName = "A_CostCenter";
	/**
	 * Default url path for the according service.
	 */
	static override _defaultBasePath =
		"/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV";
	/**
	 * All key fields of the CostCenter entity.
	 */
	static _keys = ["ControllingArea", "CostCenter", "ValidityEndDate"];
	/**
	 * Controlling Area.
	 * Maximum length: 4.
	 */
	declare controllingArea: DeserializedType<T, "Edm.String">;
	/**
	 * Cost Center.
	 * Maximum length: 10.
	 */
	declare costCenter: DeserializedType<T, "Edm.String">;
	/**
	 * Valid To Date.
	 */
	declare validityEndDate: DeserializedType<T, "Edm.DateTime">;
	/**
	 * Valid-From Date.
	 * @nullable
	 */
	declare validityStartDate?: DeserializedType<T, "Edm.DateTime"> | null;
	/**
	 * Company Code.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare companyCode?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Business Area.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare businessArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Person Responsible.
	 * Maximum length: 20.
	 * @nullable
	 */
	declare costCtrResponsiblePersonName?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * User Responsible.
	 * Maximum length: 12.
	 * @nullable
	 */
	declare costCtrResponsibleUser?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Currency Key.
	 * Maximum length: 5.
	 * @nullable
	 */
	declare costCenterCurrency?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Profit Center.
	 * Maximum length: 10.
	 * @nullable
	 */
	declare profitCenter?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Department.
	 * Maximum length: 12.
	 * @nullable
	 */
	declare department?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Costing Sheet.
	 * Maximum length: 6.
	 * @nullable
	 */
	declare costingSheet?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Functional Area.
	 * Maximum length: 16.
	 * @nullable
	 */
	declare functionalArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Country/Region Key.
	 * Maximum length: 3.
	 * @nullable
	 */
	declare country?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Region (State, Province, County).
	 * Maximum length: 3.
	 * @nullable
	 */
	declare region?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * City.
	 * Maximum length: 35.
	 * @nullable
	 */
	declare cityName?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Standard Hierarchy Area.
	 * Maximum length: 12.
	 * @nullable
	 */
	declare costCenterStandardHierArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Cost Center Category.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare costCenterCategory?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Lock Indicator for Actual Primary Postings.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlkdForPrimaryCostsPosting?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Lock Indicator for Actual Secondary Costs.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlkdForSecondaryCostsPosting?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Lock Indicator for Actual Revenue Postings.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlockedForRevenuePosting?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Lock Indicator for Commitment Update.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlockedForCommitmentPosting?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Lock Indicator for Plan Primary Costs.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlockedForPlanPrimaryCosts?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Lock Indicator for Plan Secondary Costs.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlockedForPlanSecondaryCosts?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Lock Indicator for Planning Revenues.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare isBlockedForPlanRevenues?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Indicator for Recording Consumption Quantities.
	 * Maximum length: 1.
	 * @nullable
	 */
	declare consumptionQtyIsRecorded?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Language Key.
	 * Maximum length: 2.
	 * @nullable
	 */
	declare language?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Entered By.
	 * Maximum length: 12.
	 * @nullable
	 */
	declare costCenterCreatedByUser?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Entered On.
	 * @nullable
	 */
	declare costCenterCreationDate?: DeserializedType<T, "Edm.DateTime"> | null;

	constructor(_entityApi: CostCenterApi<T>) {
		super(_entityApi);
	}
}

export interface CostCenterType<
	T extends DeSerializers = DefaultDeSerializers,
> {
	controllingArea: DeserializedType<T, "Edm.String">;
	costCenter: DeserializedType<T, "Edm.String">;
	validityEndDate: DeserializedType<T, "Edm.DateTime">;
	validityStartDate?: DeserializedType<T, "Edm.DateTime"> | null;
	companyCode?: DeserializedType<T, "Edm.String"> | null;
	businessArea?: DeserializedType<T, "Edm.String"> | null;
	costCtrResponsiblePersonName?: DeserializedType<T, "Edm.String"> | null;
	costCtrResponsibleUser?: DeserializedType<T, "Edm.String"> | null;
	costCenterCurrency?: DeserializedType<T, "Edm.String"> | null;
	profitCenter?: DeserializedType<T, "Edm.String"> | null;
	department?: DeserializedType<T, "Edm.String"> | null;
	costingSheet?: DeserializedType<T, "Edm.String"> | null;
	functionalArea?: DeserializedType<T, "Edm.String"> | null;
	country?: DeserializedType<T, "Edm.String"> | null;
	region?: DeserializedType<T, "Edm.String"> | null;
	cityName?: DeserializedType<T, "Edm.String"> | null;
	costCenterStandardHierArea?: DeserializedType<T, "Edm.String"> | null;
	costCenterCategory?: DeserializedType<T, "Edm.String"> | null;
	isBlkdForPrimaryCostsPosting?: DeserializedType<T, "Edm.String"> | null;
	isBlkdForSecondaryCostsPosting?: DeserializedType<T, "Edm.String"> | null;
	isBlockedForRevenuePosting?: DeserializedType<T, "Edm.String"> | null;
	isBlockedForCommitmentPosting?: DeserializedType<T, "Edm.String"> | null;
	isBlockedForPlanPrimaryCosts?: DeserializedType<T, "Edm.String"> | null;
	isBlockedForPlanSecondaryCosts?: DeserializedType<T, "Edm.String"> | null;
	isBlockedForPlanRevenues?: DeserializedType<T, "Edm.String"> | null;
	consumptionQtyIsRecorded?: DeserializedType<T, "Edm.String"> | null;
	language?: DeserializedType<T, "Edm.String"> | null;
	costCenterCreatedByUser?: DeserializedType<T, "Edm.String"> | null;
	costCenterCreationDate?: DeserializedType<T, "Edm.DateTime"> | null;
}
