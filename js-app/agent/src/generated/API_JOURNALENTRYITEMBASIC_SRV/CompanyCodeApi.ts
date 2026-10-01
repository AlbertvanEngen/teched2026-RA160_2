/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
	AllFields,
	CustomField,
	type DefaultDeSerializers,
	type DeSerializers,
	defaultDeSerializers,
	type EntityApi,
	type EntityBuilderType,
	entityBuilder,
	FieldBuilder,
	type OrderableEdmTypeField,
} from "@sap-cloud-sdk/odata-v2";
import { CompanyCode } from "./CompanyCode.ts";
import { CompanyCodeRequestBuilder } from "./CompanyCodeRequestBuilder.ts";
export class CompanyCodeApi<
	DeSerializersT extends DeSerializers = DefaultDeSerializers,
> implements EntityApi<CompanyCode<DeSerializersT>, DeSerializersT>
{
	public deSerializers: DeSerializersT;

	private constructor(
		deSerializers: DeSerializersT = defaultDeSerializers as any,
	) {
		this.deSerializers = deSerializers;
	}

	/**
	 * Do not use this method or the constructor directly.
	 * Use the service function as described in the documentation to get an API instance.
	 */
	public static _privateFactory<
		DeSerializersT extends DeSerializers = DefaultDeSerializers,
	>(
		deSerializers: DeSerializersT = defaultDeSerializers as any,
	): CompanyCodeApi<DeSerializersT> {
		return new CompanyCodeApi(deSerializers);
	}

	private navigationPropertyFields!: {};

	_addNavigationProperties(linkedApis: []): this {
		this.navigationPropertyFields = {};
		return this;
	}

	entityConstructor = CompanyCode;

	requestBuilder(): CompanyCodeRequestBuilder<DeSerializersT> {
		return new CompanyCodeRequestBuilder<DeSerializersT>(this);
	}

	entityBuilder(): EntityBuilderType<
		CompanyCode<DeSerializersT>,
		DeSerializersT
	> {
		return entityBuilder<CompanyCode<DeSerializersT>, DeSerializersT>(this);
	}

	customField<NullableT extends boolean = false>(
		fieldName: string,
		isNullable: NullableT = false as NullableT,
	): CustomField<CompanyCode<DeSerializersT>, DeSerializersT, NullableT> {
		return new CustomField(
			fieldName,
			this.entityConstructor,
			this.deSerializers,
			isNullable,
		) as any;
	}

	private _fieldBuilder?: FieldBuilder<typeof CompanyCode, DeSerializersT>;
	get fieldBuilder() {
		if (!this._fieldBuilder) {
			this._fieldBuilder = new FieldBuilder(CompanyCode, this.deSerializers);
		}
		return this._fieldBuilder;
	}

	private _schema?: {
		COMPANY_CODE: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		COMPANY_CODE_NAME: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CITY_NAME: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COUNTRY: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CURRENCY: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LANGUAGE: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CHART_OF_ACCOUNTS: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FISCAL_YEAR_VARIANT: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COMPANY: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CREDIT_CONTROL_AREA: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COUNTRY_CHART_OF_ACCOUNTS: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FINANCIAL_MANAGEMENT_AREA: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		ADDRESS_ID: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		TAXABLE_ENTITY: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		VAT_REGISTRATION: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		EXTENDED_WHLDG_TAX_IS_ACTIVE: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		CONTROLLING_AREA: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FIELD_STATUS_VARIANT: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		NON_TAXABLE_TRANSACTION_TAX_CODE: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DOC_DATE_IS_USED_FOR_TAX_DETN: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		TAX_RPTG_DATE_IS_ACTIVE: OrderableEdmTypeField<
			CompanyCode<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		ALL_FIELDS: AllFields<CompanyCode<DeSerializers>>;
	};

	get schema() {
		if (!this._schema) {
			const fieldBuilder = this.fieldBuilder;
			this._schema = {
				/**
				 * Static representation of the {@link companyCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COMPANY_CODE: fieldBuilder.buildEdmTypeField(
					"CompanyCode",
					"Edm.String",
					false,
				),
				/**
				 * Static representation of the {@link companyCodeName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COMPANY_CODE_NAME: fieldBuilder.buildEdmTypeField(
					"CompanyCodeName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link cityName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CITY_NAME: fieldBuilder.buildEdmTypeField(
					"CityName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link country} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COUNTRY: fieldBuilder.buildEdmTypeField("Country", "Edm.String", true),
				/**
				 * Static representation of the {@link currency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CURRENCY: fieldBuilder.buildEdmTypeField(
					"Currency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link language} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				LANGUAGE: fieldBuilder.buildEdmTypeField(
					"Language",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link chartOfAccounts} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CHART_OF_ACCOUNTS: fieldBuilder.buildEdmTypeField(
					"ChartOfAccounts",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link fiscalYearVariant} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FISCAL_YEAR_VARIANT: fieldBuilder.buildEdmTypeField(
					"FiscalYearVariant",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link company} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COMPANY: fieldBuilder.buildEdmTypeField("Company", "Edm.String", true),
				/**
				 * Static representation of the {@link creditControlArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CREDIT_CONTROL_AREA: fieldBuilder.buildEdmTypeField(
					"CreditControlArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link countryChartOfAccounts} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COUNTRY_CHART_OF_ACCOUNTS: fieldBuilder.buildEdmTypeField(
					"CountryChartOfAccounts",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link financialManagementArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FINANCIAL_MANAGEMENT_AREA: fieldBuilder.buildEdmTypeField(
					"FinancialManagementArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link addressId} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ADDRESS_ID: fieldBuilder.buildEdmTypeField(
					"AddressID",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link taxableEntity} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TAXABLE_ENTITY: fieldBuilder.buildEdmTypeField(
					"TaxableEntity",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link vatRegistration} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				VAT_REGISTRATION: fieldBuilder.buildEdmTypeField(
					"VATRegistration",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link extendedWhldgTaxIsActive} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				EXTENDED_WHLDG_TAX_IS_ACTIVE: fieldBuilder.buildEdmTypeField(
					"ExtendedWhldgTaxIsActive",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link controllingArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CONTROLLING_AREA: fieldBuilder.buildEdmTypeField(
					"ControllingArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link fieldStatusVariant} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FIELD_STATUS_VARIANT: fieldBuilder.buildEdmTypeField(
					"FieldStatusVariant",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link nonTaxableTransactionTaxCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				NON_TAXABLE_TRANSACTION_TAX_CODE: fieldBuilder.buildEdmTypeField(
					"NonTaxableTransactionTaxCode",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link docDateIsUsedForTaxDetn} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DOC_DATE_IS_USED_FOR_TAX_DETN: fieldBuilder.buildEdmTypeField(
					"DocDateIsUsedForTaxDetn",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link taxRptgDateIsActive} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TAX_RPTG_DATE_IS_ACTIVE: fieldBuilder.buildEdmTypeField(
					"TaxRptgDateIsActive",
					"Edm.Boolean",
					true,
				),
				...this.navigationPropertyFields,
				/**
				 *
				 * All fields selector.
				 */
				ALL_FIELDS: new AllFields("*", CompanyCode),
			};
		}

		return this._schema;
	}
}
