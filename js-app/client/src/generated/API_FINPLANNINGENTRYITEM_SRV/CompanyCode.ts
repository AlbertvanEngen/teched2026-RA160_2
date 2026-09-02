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
import type { CompanyCodeApi } from "./CompanyCodeApi.js";

/**
 * This class represents the entity "A_CompanyCode" of service "API_FINPLANNINGENTRYITEM_SRV".
 */
export class CompanyCode<T extends DeSerializers = DefaultDeSerializers>
	extends Entity
	implements CompanyCodeType<T>
{
	/**
	 * Technical entity name for CompanyCode.
	 */
	static override _entityName = "A_CompanyCode";
	/**
	 * Default url path for the according service.
	 */
	static override _defaultBasePath =
		"/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV";
	/**
	 * All key fields of the CompanyCode entity.
	 */
	static _keys = ["CompanyCode"];
	/**
	 * Company Code.
	 * Maximum length: 4.
	 */
	declare companyCode: DeserializedType<T, "Edm.String">;
	/**
	 * Name of Company Code or Company.
	 * Maximum length: 25.
	 * @nullable
	 */
	declare companyCodeName?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * City.
	 * Maximum length: 25.
	 * @nullable
	 */
	declare cityName?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Country/Region Key.
	 * Maximum length: 3.
	 * @nullable
	 */
	declare country?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Currency Key.
	 * Maximum length: 5.
	 * @nullable
	 */
	declare currency?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Language Key.
	 * Maximum length: 2.
	 * @nullable
	 */
	declare language?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Chart of Accounts.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare chartOfAccounts?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Fiscal Year Variant.
	 * Maximum length: 2.
	 * @nullable
	 */
	declare fiscalYearVariant?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Company.
	 * Maximum length: 6.
	 * @nullable
	 */
	declare company?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Credit Control Area.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare creditControlArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Alternative Chart of Accounts.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare countryChartOfAccounts?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Financial Management Area.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare financialManagementArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Address.
	 * Maximum length: 10.
	 * @nullable
	 */
	declare addressId?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Taxes on Sales/Purchases Group.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare taxableEntity?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * VAT Registration Number.
	 * Maximum length: 20.
	 * @nullable
	 */
	declare vatRegistration?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Indicator: Extended Withholding Tax Active.
	 * @nullable
	 */
	declare extendedWhldgTaxIsActive?: DeserializedType<T, "Edm.Boolean"> | null;
	/**
	 * Controlling Area.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare controllingArea?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Field Status Variant.
	 * Maximum length: 4.
	 * @nullable
	 */
	declare fieldStatusVariant?: DeserializedType<T, "Edm.String"> | null;
	/**
	 * Output Tax Code for Non-Taxable Transactions.
	 * Maximum length: 2.
	 * @nullable
	 */
	declare nonTaxableTransactionTaxCode?: DeserializedType<
		T,
		"Edm.String"
	> | null;
	/**
	 * Indicator: Document Date As the Basis for Tax Determination.
	 * @nullable
	 */
	declare docDateIsUsedForTaxDetn?: DeserializedType<T, "Edm.Boolean"> | null;
	/**
	 * Tax Reporting Date Active in Documents.
	 * @nullable
	 */
	declare taxRptgDateIsActive?: DeserializedType<T, "Edm.Boolean"> | null;

	constructor(_entityApi: CompanyCodeApi<T>) {
		super(_entityApi);
	}
}

export interface CompanyCodeType<
	T extends DeSerializers = DefaultDeSerializers,
> {
	companyCode: DeserializedType<T, "Edm.String">;
	companyCodeName?: DeserializedType<T, "Edm.String"> | null;
	cityName?: DeserializedType<T, "Edm.String"> | null;
	country?: DeserializedType<T, "Edm.String"> | null;
	currency?: DeserializedType<T, "Edm.String"> | null;
	language?: DeserializedType<T, "Edm.String"> | null;
	chartOfAccounts?: DeserializedType<T, "Edm.String"> | null;
	fiscalYearVariant?: DeserializedType<T, "Edm.String"> | null;
	company?: DeserializedType<T, "Edm.String"> | null;
	creditControlArea?: DeserializedType<T, "Edm.String"> | null;
	countryChartOfAccounts?: DeserializedType<T, "Edm.String"> | null;
	financialManagementArea?: DeserializedType<T, "Edm.String"> | null;
	addressId?: DeserializedType<T, "Edm.String"> | null;
	taxableEntity?: DeserializedType<T, "Edm.String"> | null;
	vatRegistration?: DeserializedType<T, "Edm.String"> | null;
	extendedWhldgTaxIsActive?: DeserializedType<T, "Edm.Boolean"> | null;
	controllingArea?: DeserializedType<T, "Edm.String"> | null;
	fieldStatusVariant?: DeserializedType<T, "Edm.String"> | null;
	nonTaxableTransactionTaxCode?: DeserializedType<T, "Edm.String"> | null;
	docDateIsUsedForTaxDetn?: DeserializedType<T, "Edm.Boolean"> | null;
	taxRptgDateIsActive?: DeserializedType<T, "Edm.Boolean"> | null;
}
