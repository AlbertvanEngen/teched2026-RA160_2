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
import { FinPlanEntryItemVariableFix } from "./FinPlanEntryItemVariableFix.js";
import { FinPlanEntryItemVariableFixRequestBuilder } from "./FinPlanEntryItemVariableFixRequestBuilder.js";
export class FinPlanEntryItemVariableFixApi<
	DeSerializersT extends DeSerializers = DefaultDeSerializers,
> implements
		EntityApi<FinPlanEntryItemVariableFix<DeSerializersT>, DeSerializersT>
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
	): FinPlanEntryItemVariableFixApi<DeSerializersT> {
		return new FinPlanEntryItemVariableFixApi(deSerializers);
	}

	private navigationPropertyFields!: {};

	_addNavigationProperties(linkedApis: []): this {
		this.navigationPropertyFields = {};
		return this;
	}

	entityConstructor = FinPlanEntryItemVariableFix;

	requestBuilder(): FinPlanEntryItemVariableFixRequestBuilder<DeSerializersT> {
		return new FinPlanEntryItemVariableFixRequestBuilder<DeSerializersT>(this);
	}

	entityBuilder(): EntityBuilderType<
		FinPlanEntryItemVariableFix<DeSerializersT>,
		DeSerializersT
	> {
		return entityBuilder<
			FinPlanEntryItemVariableFix<DeSerializersT>,
			DeSerializersT
		>(this);
	}

	customField<NullableT extends boolean = false>(
		fieldName: string,
		isNullable: NullableT = false as NullableT,
	): CustomField<
		FinPlanEntryItemVariableFix<DeSerializersT>,
		DeSerializersT,
		NullableT
	> {
		return new CustomField(
			fieldName,
			this.entityConstructor,
			this.deSerializers,
			isNullable,
		) as any;
	}

	private _fieldBuilder?: FieldBuilder<
		typeof FinPlanEntryItemVariableFix,
		DeSerializersT
	>;
	get fieldBuilder() {
		if (!this._fieldBuilder) {
			this._fieldBuilder = new FieldBuilder(
				FinPlanEntryItemVariableFix,
				this.deSerializers,
			);
		}
		return this._fieldBuilder;
	}

	private _schema?: {
		ID: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		FIXED_VARIABLE_TYPE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LEDGER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LEDGER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PLANNING_CATEGORY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LEDGER_FISCAL_YEAR: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		GL_ACCOUNT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		GL_ACCOUNT_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COMPANY_CODE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COMPANY_CODE_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FINANCIAL_TRANSACTION_TYPE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COST_CENTER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COST_CENTER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FUNCTIONAL_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FUNCTIONAL_AREA_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		BUSINESS_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		BUSINESS_AREA_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CONTROLLING_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CONTROLLING_AREA_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SEGMENT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SEGMENT_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COST_CENTER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COST_CENTER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_PROFIT_CENTER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_PROFIT_CENTER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_FUNCTIONAL_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_FUNCTIONAL_AREA_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_BUSINESS_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_BUSINESS_AREA_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COMPANY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COMPANY_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_SEGMENT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_SEGMENT_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		TRANSACTION_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_TRANSACTION_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		COMPANY_CODE_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_COMPANY_CODE_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		GLOBAL_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_GLOBAL_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		CONTROLLING_OBJECT_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_OBJECT_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FUNCTIONAL_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FUNCTIONAL_CURRENCY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		COST_SOURCE_UNIT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		VALUATION_QUANTITY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		REFERENCE_QUANTITY_UNIT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		REFERENCE_QUANTITY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_1: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_1: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_2: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_2: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_3: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_3: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_4: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_4: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_5: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_5: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_6: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_6: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_7: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_7: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FREE_DEFINED_CURRENCY_8: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		AMOUNT_IN_FREE_DEFINED_CURRENCY_8: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.Decimal",
			true,
			true
		>;
		FISCAL_PERIOD: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FISCAL_YEAR_VARIANT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FISCAL_YEAR_PERIOD: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CHART_OF_ACCOUNTS: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PLANT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PLANT_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CONTROLLING_DEBIT_CREDIT_CODE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROJECT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROJECT_DESCRIPTION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		WBS_ELEMENT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		WBS_ELEMENT_DESCRIPTION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COMPANY_CODE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COMPANY_CODE_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COST_CTR_ACTIVITY_TYPE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COST_CTR_ACTIVITY_TYPE_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		ORDER_ID: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_ORDER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COST_CTR_ACTIVITY_TYPE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_COST_CTR_ACTIVITY_TYPE_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_PROJECT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_PROJECT_DESCRIPTION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_WBS_ELEMENT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PARTNER_WBS_ELEMENT_DESCRIPTION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SALES_ORGANIZATION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SALES_ORGANIZATION_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DISTRIBUTION_CHANNEL: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DISTRIBUTION_CHANNEL_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DIVISION: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DIVISION_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SOLD_MATERIAL: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SOLD_MATERIAL_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		MATERIAL_GROUP: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		MATERIAL_GROUP_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_GROUP: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_GROUP_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_SUPPLIER_COUNTRY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_SUPPLIER_COUNTRY_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_SUPPLIER_INDUSTRY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CUSTOMER_SUPPLIER_INDUSTRY_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SALES_DISTRICT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SALES_DISTRICT_NAME: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FINANCIAL_MANAGEMENT_AREA: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FUND: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		GRANT_ID: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		BUDGET_PERIOD: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		BUDGET_PROCESS: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		BUDGETING_TYPE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SPONSORED_PROGRAM: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SPONSORED_CLASS: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		GTEE_M_BUDGET_VALIDITY_NUMBER: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		RE_BUSINESS_ENTITY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		REAL_ESTATE_BUILDING: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		REAL_ESTATE_PROPERTY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		RE_RENTAL_OBJECT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		REAL_ESTATE_CONTRACT: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		RE_SERVICE_CHARGE_KEY: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		RE_SETTLEMENT_UNIT_ID: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SETTLEMENT_REFERENCE_DATE: OrderableEdmTypeField<
			FinPlanEntryItemVariableFix<DeSerializers>,
			DeSerializersT,
			"Edm.DateTime",
			true,
			true
		>;
		ALL_FIELDS: AllFields<FinPlanEntryItemVariableFix<DeSerializers>>;
	};

	get schema() {
		if (!this._schema) {
			const fieldBuilder = this.fieldBuilder;
			this._schema = {
				/**
				 * Static representation of the {@link id} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ID: fieldBuilder.buildEdmTypeField("ID", "Edm.String", false),
				/**
				 * Static representation of the {@link fixedVariableType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FIXED_VARIABLE_TYPE: fieldBuilder.buildEdmTypeField(
					"FixedVariableType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link ledger} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				LEDGER: fieldBuilder.buildEdmTypeField("Ledger", "Edm.String", true),
				/**
				 * Static representation of the {@link ledgerName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				LEDGER_NAME: fieldBuilder.buildEdmTypeField(
					"LedgerName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link planningCategory} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PLANNING_CATEGORY: fieldBuilder.buildEdmTypeField(
					"PlanningCategory",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link ledgerFiscalYear} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				LEDGER_FISCAL_YEAR: fieldBuilder.buildEdmTypeField(
					"LedgerFiscalYear",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link glAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"GLAccount",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link glAccountName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT_NAME: fieldBuilder.buildEdmTypeField(
					"GLAccountName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link companyCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COMPANY_CODE: fieldBuilder.buildEdmTypeField(
					"CompanyCode",
					"Edm.String",
					true,
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
				 * Static representation of the {@link financialTransactionType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FINANCIAL_TRANSACTION_TYPE: fieldBuilder.buildEdmTypeField(
					"FinancialTransactionType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link costCenter} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COST_CENTER: fieldBuilder.buildEdmTypeField(
					"CostCenter",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link costCenterName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COST_CENTER_NAME: fieldBuilder.buildEdmTypeField(
					"CostCenterName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenter} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER: fieldBuilder.buildEdmTypeField(
					"ProfitCenter",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_NAME: fieldBuilder.buildEdmTypeField(
					"ProfitCenterName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link functionalArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FUNCTIONAL_AREA: fieldBuilder.buildEdmTypeField(
					"FunctionalArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link functionalAreaName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FUNCTIONAL_AREA_NAME: fieldBuilder.buildEdmTypeField(
					"FunctionalAreaName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link businessArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				BUSINESS_AREA: fieldBuilder.buildEdmTypeField(
					"BusinessArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link businessAreaName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				BUSINESS_AREA_NAME: fieldBuilder.buildEdmTypeField(
					"BusinessAreaName",
					"Edm.String",
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
				 * Static representation of the {@link controllingAreaName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CONTROLLING_AREA_NAME: fieldBuilder.buildEdmTypeField(
					"ControllingAreaName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link segment} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SEGMENT: fieldBuilder.buildEdmTypeField("Segment", "Edm.String", true),
				/**
				 * Static representation of the {@link segmentName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SEGMENT_NAME: fieldBuilder.buildEdmTypeField(
					"SegmentName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCostCenter} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COST_CENTER: fieldBuilder.buildEdmTypeField(
					"PartnerCostCenter",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCostCenterName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COST_CENTER_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerCostCenterName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerProfitCenter} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_PROFIT_CENTER: fieldBuilder.buildEdmTypeField(
					"PartnerProfitCenter",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerProfitCenterName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_PROFIT_CENTER_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerProfitCenterName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerFunctionalArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_FUNCTIONAL_AREA: fieldBuilder.buildEdmTypeField(
					"PartnerFunctionalArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerFunctionalAreaName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_FUNCTIONAL_AREA_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerFunctionalAreaName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerBusinessArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_BUSINESS_AREA: fieldBuilder.buildEdmTypeField(
					"PartnerBusinessArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerBusinessAreaName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_BUSINESS_AREA_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerBusinessAreaName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCompany} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COMPANY: fieldBuilder.buildEdmTypeField(
					"PartnerCompany",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCompanyName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COMPANY_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerCompanyName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerSegment} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_SEGMENT: fieldBuilder.buildEdmTypeField(
					"PartnerSegment",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerSegmentName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_SEGMENT_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerSegmentName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link transactionCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TRANSACTION_CURRENCY: fieldBuilder.buildEdmTypeField(
					"TransactionCurrency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInTransactionCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_TRANSACTION_CURRENCY: fieldBuilder.buildEdmTypeField(
					"AmountInTransactionCurrency",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link companyCodeCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COMPANY_CODE_CURRENCY: fieldBuilder.buildEdmTypeField(
					"CompanyCodeCurrency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInCompanyCodeCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_COMPANY_CODE_CURRENCY: fieldBuilder.buildEdmTypeField(
					"AmountInCompanyCodeCurrency",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link globalCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GLOBAL_CURRENCY: fieldBuilder.buildEdmTypeField(
					"GlobalCurrency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInGlobalCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_GLOBAL_CURRENCY: fieldBuilder.buildEdmTypeField(
					"AmountInGlobalCurrency",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link controllingObjectCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CONTROLLING_OBJECT_CURRENCY: fieldBuilder.buildEdmTypeField(
					"ControllingObjectCurrency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInObjectCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_OBJECT_CURRENCY: fieldBuilder.buildEdmTypeField(
					"AmountInObjectCurrency",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link functionalCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FUNCTIONAL_CURRENCY: fieldBuilder.buildEdmTypeField(
					"FunctionalCurrency",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFunctionalCurrency} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FUNCTIONAL_CURRENCY: fieldBuilder.buildEdmTypeField(
					"AmountInFunctionalCurrency",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link costSourceUnit} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COST_SOURCE_UNIT: fieldBuilder.buildEdmTypeField(
					"CostSourceUnit",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link valuationQuantity} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				VALUATION_QUANTITY: fieldBuilder.buildEdmTypeField(
					"ValuationQuantity",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link referenceQuantityUnit} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REFERENCE_QUANTITY_UNIT: fieldBuilder.buildEdmTypeField(
					"ReferenceQuantityUnit",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link referenceQuantity} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REFERENCE_QUANTITY: fieldBuilder.buildEdmTypeField(
					"ReferenceQuantity",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency1} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_1: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency1",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency1} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_1: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency1",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency2} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_2: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency2",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency2} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_2: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency2",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency3} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_3: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency3",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency3} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_3: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency3",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency4} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_4: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency4",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency4} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_4: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency4",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency5} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_5: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency5",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency5} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_5: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency5",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency6} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_6: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency6",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency6} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_6: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency6",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency7} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_7: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency7",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency7} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_7: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency7",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link freeDefinedCurrency8} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FREE_DEFINED_CURRENCY_8: fieldBuilder.buildEdmTypeField(
					"FreeDefinedCurrency8",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link amountInFreeDefinedCurrency8} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				AMOUNT_IN_FREE_DEFINED_CURRENCY_8: fieldBuilder.buildEdmTypeField(
					"AmountInFreeDefinedCurrency8",
					"Edm.Decimal",
					true,
				),
				/**
				 * Static representation of the {@link fiscalPeriod} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FISCAL_PERIOD: fieldBuilder.buildEdmTypeField(
					"FiscalPeriod",
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
				 * Static representation of the {@link fiscalYearPeriod} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FISCAL_YEAR_PERIOD: fieldBuilder.buildEdmTypeField(
					"FiscalYearPeriod",
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
				 * Static representation of the {@link plant} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PLANT: fieldBuilder.buildEdmTypeField("Plant", "Edm.String", true),
				/**
				 * Static representation of the {@link plantName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PLANT_NAME: fieldBuilder.buildEdmTypeField(
					"PlantName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customer} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER: fieldBuilder.buildEdmTypeField(
					"Customer",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_NAME: fieldBuilder.buildEdmTypeField(
					"CustomerName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link controllingDebitCreditCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CONTROLLING_DEBIT_CREDIT_CODE: fieldBuilder.buildEdmTypeField(
					"ControllingDebitCreditCode",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link project} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROJECT: fieldBuilder.buildEdmTypeField("Project", "Edm.String", true),
				/**
				 * Static representation of the {@link projectDescription} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROJECT_DESCRIPTION: fieldBuilder.buildEdmTypeField(
					"ProjectDescription",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link wbsElement} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				WBS_ELEMENT: fieldBuilder.buildEdmTypeField(
					"WBSElement",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link wbsElementDescription} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				WBS_ELEMENT_DESCRIPTION: fieldBuilder.buildEdmTypeField(
					"WBSElementDescription",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCompanyCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COMPANY_CODE: fieldBuilder.buildEdmTypeField(
					"PartnerCompanyCode",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCompanyCodeName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COMPANY_CODE_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerCompanyCodeName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link costCtrActivityType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COST_CTR_ACTIVITY_TYPE: fieldBuilder.buildEdmTypeField(
					"CostCtrActivityType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link costCtrActivityTypeName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COST_CTR_ACTIVITY_TYPE_NAME: fieldBuilder.buildEdmTypeField(
					"CostCtrActivityTypeName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link orderId} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ORDER_ID: fieldBuilder.buildEdmTypeField("OrderID", "Edm.String", true),
				/**
				 * Static representation of the {@link partnerOrder} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_ORDER: fieldBuilder.buildEdmTypeField(
					"PartnerOrder",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCostCtrActivityType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COST_CTR_ACTIVITY_TYPE: fieldBuilder.buildEdmTypeField(
					"PartnerCostCtrActivityType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerCostCtrActivityTypeName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_COST_CTR_ACTIVITY_TYPE_NAME: fieldBuilder.buildEdmTypeField(
					"PartnerCostCtrActivityTypeName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerProject} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_PROJECT: fieldBuilder.buildEdmTypeField(
					"PartnerProject",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerProjectDescription} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_PROJECT_DESCRIPTION: fieldBuilder.buildEdmTypeField(
					"PartnerProjectDescription",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerWbsElement} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_WBS_ELEMENT: fieldBuilder.buildEdmTypeField(
					"PartnerWBSElement",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link partnerWbsElementDescription} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PARTNER_WBS_ELEMENT_DESCRIPTION: fieldBuilder.buildEdmTypeField(
					"PartnerWBSElementDescription",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link salesOrganization} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SALES_ORGANIZATION: fieldBuilder.buildEdmTypeField(
					"SalesOrganization",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link salesOrganizationName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SALES_ORGANIZATION_NAME: fieldBuilder.buildEdmTypeField(
					"SalesOrganizationName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link distributionChannel} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DISTRIBUTION_CHANNEL: fieldBuilder.buildEdmTypeField(
					"DistributionChannel",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link distributionChannelName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DISTRIBUTION_CHANNEL_NAME: fieldBuilder.buildEdmTypeField(
					"DistributionChannelName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link division} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DIVISION: fieldBuilder.buildEdmTypeField(
					"Division",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link divisionName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DIVISION_NAME: fieldBuilder.buildEdmTypeField(
					"DivisionName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link soldMaterial} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SOLD_MATERIAL: fieldBuilder.buildEdmTypeField(
					"SoldMaterial",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link soldMaterialName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SOLD_MATERIAL_NAME: fieldBuilder.buildEdmTypeField(
					"SoldMaterialName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link materialGroup} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				MATERIAL_GROUP: fieldBuilder.buildEdmTypeField(
					"MaterialGroup",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link materialGroupName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				MATERIAL_GROUP_NAME: fieldBuilder.buildEdmTypeField(
					"MaterialGroupName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerGroup} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_GROUP: fieldBuilder.buildEdmTypeField(
					"CustomerGroup",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerGroupName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_GROUP_NAME: fieldBuilder.buildEdmTypeField(
					"CustomerGroupName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerSupplierCountry} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_SUPPLIER_COUNTRY: fieldBuilder.buildEdmTypeField(
					"CustomerSupplierCountry",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerSupplierCountryName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_SUPPLIER_COUNTRY_NAME: fieldBuilder.buildEdmTypeField(
					"CustomerSupplierCountryName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerSupplierIndustry} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_SUPPLIER_INDUSTRY: fieldBuilder.buildEdmTypeField(
					"CustomerSupplierIndustry",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link customerSupplierIndustryName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CUSTOMER_SUPPLIER_INDUSTRY_NAME: fieldBuilder.buildEdmTypeField(
					"CustomerSupplierIndustryName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link salesDistrict} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SALES_DISTRICT: fieldBuilder.buildEdmTypeField(
					"SalesDistrict",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link salesDistrictName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SALES_DISTRICT_NAME: fieldBuilder.buildEdmTypeField(
					"SalesDistrictName",
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
				 * Static representation of the {@link fund} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FUND: fieldBuilder.buildEdmTypeField("Fund", "Edm.String", true),
				/**
				 * Static representation of the {@link grantId} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GRANT_ID: fieldBuilder.buildEdmTypeField("GrantID", "Edm.String", true),
				/**
				 * Static representation of the {@link budgetPeriod} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				BUDGET_PERIOD: fieldBuilder.buildEdmTypeField(
					"BudgetPeriod",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link budgetProcess} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				BUDGET_PROCESS: fieldBuilder.buildEdmTypeField(
					"BudgetProcess",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link budgetingType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				BUDGETING_TYPE: fieldBuilder.buildEdmTypeField(
					"BudgetingType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link sponsoredProgram} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SPONSORED_PROGRAM: fieldBuilder.buildEdmTypeField(
					"SponsoredProgram",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link sponsoredClass} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SPONSORED_CLASS: fieldBuilder.buildEdmTypeField(
					"SponsoredClass",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link gteeMBudgetValidityNumber} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GTEE_M_BUDGET_VALIDITY_NUMBER: fieldBuilder.buildEdmTypeField(
					"GteeMBudgetValidityNumber",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link reBusinessEntity} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				RE_BUSINESS_ENTITY: fieldBuilder.buildEdmTypeField(
					"REBusinessEntity",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link realEstateBuilding} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REAL_ESTATE_BUILDING: fieldBuilder.buildEdmTypeField(
					"RealEstateBuilding",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link realEstateProperty} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REAL_ESTATE_PROPERTY: fieldBuilder.buildEdmTypeField(
					"RealEstateProperty",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link reRentalObject} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				RE_RENTAL_OBJECT: fieldBuilder.buildEdmTypeField(
					"RERentalObject",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link realEstateContract} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REAL_ESTATE_CONTRACT: fieldBuilder.buildEdmTypeField(
					"RealEstateContract",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link reServiceChargeKey} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				RE_SERVICE_CHARGE_KEY: fieldBuilder.buildEdmTypeField(
					"REServiceChargeKey",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link reSettlementUnitId} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				RE_SETTLEMENT_UNIT_ID: fieldBuilder.buildEdmTypeField(
					"RESettlementUnitID",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link settlementReferenceDate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SETTLEMENT_REFERENCE_DATE: fieldBuilder.buildEdmTypeField(
					"SettlementReferenceDate",
					"Edm.DateTime",
					true,
				),
				...this.navigationPropertyFields,
				/**
				 *
				 * All fields selector.
				 */
				ALL_FIELDS: new AllFields("*", FinPlanEntryItemVariableFix),
			};
		}

		return this._schema;
	}
}
