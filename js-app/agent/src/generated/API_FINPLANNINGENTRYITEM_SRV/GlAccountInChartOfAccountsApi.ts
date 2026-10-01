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
import { GlAccountInChartOfAccounts } from "./GlAccountInChartOfAccounts.ts";
import { GlAccountInChartOfAccountsRequestBuilder } from "./GlAccountInChartOfAccountsRequestBuilder.ts";
export class GlAccountInChartOfAccountsApi<
	DeSerializersT extends DeSerializers = DefaultDeSerializers,
> implements
		EntityApi<GlAccountInChartOfAccounts<DeSerializersT>, DeSerializersT>
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
	): GlAccountInChartOfAccountsApi<DeSerializersT> {
		return new GlAccountInChartOfAccountsApi(deSerializers);
	}

	private navigationPropertyFields!: {};

	_addNavigationProperties(linkedApis: []): this {
		this.navigationPropertyFields = {};
		return this;
	}

	entityConstructor = GlAccountInChartOfAccounts;

	requestBuilder(): GlAccountInChartOfAccountsRequestBuilder<DeSerializersT> {
		return new GlAccountInChartOfAccountsRequestBuilder<DeSerializersT>(this);
	}

	entityBuilder(): EntityBuilderType<
		GlAccountInChartOfAccounts<DeSerializersT>,
		DeSerializersT
	> {
		return entityBuilder<
			GlAccountInChartOfAccounts<DeSerializersT>,
			DeSerializersT
		>(this);
	}

	customField<NullableT extends boolean = false>(
		fieldName: string,
		isNullable: NullableT = false as NullableT,
	): CustomField<
		GlAccountInChartOfAccounts<DeSerializersT>,
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
		typeof GlAccountInChartOfAccounts,
		DeSerializersT
	>;
	get fieldBuilder() {
		if (!this._fieldBuilder) {
			this._fieldBuilder = new FieldBuilder(
				GlAccountInChartOfAccounts,
				this.deSerializers,
			);
		}
		return this._fieldBuilder;
	}

	private _schema?: {
		CHART_OF_ACCOUNTS: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		GL_ACCOUNT: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		IS_BALANCE_SHEET_ACCOUNT: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		GL_ACCOUNT_GROUP: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CORPORATE_GROUP_ACCOUNT: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_LOSS_ACCOUNT_TYPE: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SAMPLE_GL_ACCOUNT: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		ACCOUNT_IS_MARKED_FOR_DELETION: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		ACCOUNT_IS_BLOCKED_FOR_CREATION: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		ACCOUNT_IS_BLOCKED_FOR_POSTING: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		ACCOUNT_IS_BLOCKED_FOR_PLANNING: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		PARTNER_COMPANY: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FUNCTIONAL_AREA: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CREATION_DATE: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.DateTime",
			true,
			true
		>;
		CREATED_BY_USER: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LAST_CHANGE_DATE_TIME: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.DateTimeOffset",
			true,
			true
		>;
		GL_ACCOUNT_TYPE: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		GL_ACCOUNT_EXTERNAL: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		IS_PROFIT_LOSS_ACCOUNT: OrderableEdmTypeField<
			GlAccountInChartOfAccounts<DeSerializers>,
			DeSerializersT,
			"Edm.Boolean",
			true,
			true
		>;
		ALL_FIELDS: AllFields<GlAccountInChartOfAccounts<DeSerializers>>;
	};

	get schema() {
		if (!this._schema) {
			const fieldBuilder = this.fieldBuilder;
			this._schema = {
				/**
				 * Static representation of the {@link chartOfAccounts} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CHART_OF_ACCOUNTS: fieldBuilder.buildEdmTypeField(
					"ChartOfAccounts",
					"Edm.String",
					false,
				),
				/**
				 * Static representation of the {@link glAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"GLAccount",
					"Edm.String",
					false,
				),
				/**
				 * Static representation of the {@link isBalanceSheetAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				IS_BALANCE_SHEET_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"IsBalanceSheetAccount",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link glAccountGroup} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT_GROUP: fieldBuilder.buildEdmTypeField(
					"GLAccountGroup",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link corporateGroupAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CORPORATE_GROUP_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"CorporateGroupAccount",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitLossAccountType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_LOSS_ACCOUNT_TYPE: fieldBuilder.buildEdmTypeField(
					"ProfitLossAccountType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link sampleGlAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SAMPLE_GL_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"SampleGLAccount",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link accountIsMarkedForDeletion} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ACCOUNT_IS_MARKED_FOR_DELETION: fieldBuilder.buildEdmTypeField(
					"AccountIsMarkedForDeletion",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link accountIsBlockedForCreation} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ACCOUNT_IS_BLOCKED_FOR_CREATION: fieldBuilder.buildEdmTypeField(
					"AccountIsBlockedForCreation",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link accountIsBlockedForPosting} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ACCOUNT_IS_BLOCKED_FOR_POSTING: fieldBuilder.buildEdmTypeField(
					"AccountIsBlockedForPosting",
					"Edm.Boolean",
					true,
				),
				/**
				 * Static representation of the {@link accountIsBlockedForPlanning} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ACCOUNT_IS_BLOCKED_FOR_PLANNING: fieldBuilder.buildEdmTypeField(
					"AccountIsBlockedForPlanning",
					"Edm.Boolean",
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
				 * Static representation of the {@link functionalArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FUNCTIONAL_AREA: fieldBuilder.buildEdmTypeField(
					"FunctionalArea",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link creationDate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CREATION_DATE: fieldBuilder.buildEdmTypeField(
					"CreationDate",
					"Edm.DateTime",
					true,
				),
				/**
				 * Static representation of the {@link createdByUser} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CREATED_BY_USER: fieldBuilder.buildEdmTypeField(
					"CreatedByUser",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link lastChangeDateTime} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				LAST_CHANGE_DATE_TIME: fieldBuilder.buildEdmTypeField(
					"LastChangeDateTime",
					"Edm.DateTimeOffset",
					true,
				),
				/**
				 * Static representation of the {@link glAccountType} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT_TYPE: fieldBuilder.buildEdmTypeField(
					"GLAccountType",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link glAccountExternal} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				GL_ACCOUNT_EXTERNAL: fieldBuilder.buildEdmTypeField(
					"GLAccountExternal",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link isProfitLossAccount} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				IS_PROFIT_LOSS_ACCOUNT: fieldBuilder.buildEdmTypeField(
					"IsProfitLossAccount",
					"Edm.Boolean",
					true,
				),
				...this.navigationPropertyFields,
				/**
				 *
				 * All fields selector.
				 */
				ALL_FIELDS: new AllFields("*", GlAccountInChartOfAccounts),
			};
		}

		return this._schema;
	}
}
