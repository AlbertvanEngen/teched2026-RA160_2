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
import { ProfitCenter } from "./ProfitCenter.js";
import { ProfitCenterRequestBuilder } from "./ProfitCenterRequestBuilder.js";
export class ProfitCenterApi<
	DeSerializersT extends DeSerializers = DefaultDeSerializers,
> implements EntityApi<ProfitCenter<DeSerializersT>, DeSerializersT>
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
	): ProfitCenterApi<DeSerializersT> {
		return new ProfitCenterApi(deSerializers);
	}

	private navigationPropertyFields!: {};

	_addNavigationProperties(linkedApis: []): this {
		this.navigationPropertyFields = {};
		return this;
	}

	entityConstructor = ProfitCenter;

	requestBuilder(): ProfitCenterRequestBuilder<DeSerializersT> {
		return new ProfitCenterRequestBuilder<DeSerializersT>(this);
	}

	entityBuilder(): EntityBuilderType<
		ProfitCenter<DeSerializersT>,
		DeSerializersT
	> {
		return entityBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>(this);
	}

	customField<NullableT extends boolean = false>(
		fieldName: string,
		isNullable: NullableT = false as NullableT,
	): CustomField<ProfitCenter<DeSerializersT>, DeSerializersT, NullableT> {
		return new CustomField(
			fieldName,
			this.entityConstructor,
			this.deSerializers,
			isNullable,
		) as any;
	}

	private _fieldBuilder?: FieldBuilder<typeof ProfitCenter, DeSerializersT>;
	get fieldBuilder() {
		if (!this._fieldBuilder) {
			this._fieldBuilder = new FieldBuilder(ProfitCenter, this.deSerializers);
		}
		return this._fieldBuilder;
	}

	private _schema?: {
		CONTROLLING_AREA: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		PROFIT_CENTER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			false,
			true
		>;
		VALIDITY_END_DATE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.DateTime",
			false,
			true
		>;
		PROFIT_CTR_RESPONSIBLE_PERSON_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COMPANY_CODE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CTR_RESPONSIBLE_USER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		VALIDITY_START_DATE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.DateTime",
			true,
			true
		>;
		DEPARTMENT: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_STANDARD_HIERARCHY: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		SEGMENT: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_IS_BLOCKED: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FORMULA_PLANNING_TEMPLATE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FORM_OF_ADDRESS: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		ADDRESS_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		ADDITIONAL_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_ADDR_NAME_3: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_ADDR_NAME_4: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		STREET_ADDRESS_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PO_BOX: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		CITY_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		POSTAL_CODE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DISTRICT: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		COUNTRY: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		REGION: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		TAX_JURISDICTION: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		LANGUAGE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PHONE_NUMBER_1: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PHONE_NUMBER_2: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		TELEBOX_NUMBER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		TELEX_NUMBER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		FAX_NUMBER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		DATA_COMMUNICATION_PHONE_NUMBER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_PRINTER_NAME: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_CREATED_BY_USER: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.String",
			true,
			true
		>;
		PROFIT_CENTER_CREATION_DATE: OrderableEdmTypeField<
			ProfitCenter<DeSerializers>,
			DeSerializersT,
			"Edm.DateTime",
			true,
			true
		>;
		ALL_FIELDS: AllFields<ProfitCenter<DeSerializers>>;
	};

	get schema() {
		if (!this._schema) {
			const fieldBuilder = this.fieldBuilder;
			this._schema = {
				/**
				 * Static representation of the {@link controllingArea} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				CONTROLLING_AREA: fieldBuilder.buildEdmTypeField(
					"ControllingArea",
					"Edm.String",
					false,
				),
				/**
				 * Static representation of the {@link profitCenter} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER: fieldBuilder.buildEdmTypeField(
					"ProfitCenter",
					"Edm.String",
					false,
				),
				/**
				 * Static representation of the {@link validityEndDate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				VALIDITY_END_DATE: fieldBuilder.buildEdmTypeField(
					"ValidityEndDate",
					"Edm.DateTime",
					false,
				),
				/**
				 * Static representation of the {@link profitCtrResponsiblePersonName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CTR_RESPONSIBLE_PERSON_NAME: fieldBuilder.buildEdmTypeField(
					"ProfitCtrResponsiblePersonName",
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
				 * Static representation of the {@link profitCtrResponsibleUser} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CTR_RESPONSIBLE_USER: fieldBuilder.buildEdmTypeField(
					"ProfitCtrResponsibleUser",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link validityStartDate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				VALIDITY_START_DATE: fieldBuilder.buildEdmTypeField(
					"ValidityStartDate",
					"Edm.DateTime",
					true,
				),
				/**
				 * Static representation of the {@link department} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DEPARTMENT: fieldBuilder.buildEdmTypeField(
					"Department",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterStandardHierarchy} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_STANDARD_HIERARCHY: fieldBuilder.buildEdmTypeField(
					"ProfitCenterStandardHierarchy",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link segment} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				SEGMENT: fieldBuilder.buildEdmTypeField("Segment", "Edm.String", true),
				/**
				 * Static representation of the {@link profitCenterIsBlocked} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_IS_BLOCKED: fieldBuilder.buildEdmTypeField(
					"ProfitCenterIsBlocked",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link formulaPlanningTemplate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FORMULA_PLANNING_TEMPLATE: fieldBuilder.buildEdmTypeField(
					"FormulaPlanningTemplate",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link formOfAddress} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FORM_OF_ADDRESS: fieldBuilder.buildEdmTypeField(
					"FormOfAddress",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link addressName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ADDRESS_NAME: fieldBuilder.buildEdmTypeField(
					"AddressName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link additionalName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				ADDITIONAL_NAME: fieldBuilder.buildEdmTypeField(
					"AdditionalName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterAddrName3} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_ADDR_NAME_3: fieldBuilder.buildEdmTypeField(
					"ProfitCenterAddrName3",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterAddrName4} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_ADDR_NAME_4: fieldBuilder.buildEdmTypeField(
					"ProfitCenterAddrName4",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link streetAddressName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				STREET_ADDRESS_NAME: fieldBuilder.buildEdmTypeField(
					"StreetAddressName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link poBox} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PO_BOX: fieldBuilder.buildEdmTypeField("POBox", "Edm.String", true),
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
				 * Static representation of the {@link postalCode} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				POSTAL_CODE: fieldBuilder.buildEdmTypeField(
					"PostalCode",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link district} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DISTRICT: fieldBuilder.buildEdmTypeField(
					"District",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link country} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				COUNTRY: fieldBuilder.buildEdmTypeField("Country", "Edm.String", true),
				/**
				 * Static representation of the {@link region} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				REGION: fieldBuilder.buildEdmTypeField("Region", "Edm.String", true),
				/**
				 * Static representation of the {@link taxJurisdiction} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TAX_JURISDICTION: fieldBuilder.buildEdmTypeField(
					"TaxJurisdiction",
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
				 * Static representation of the {@link phoneNumber1} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PHONE_NUMBER_1: fieldBuilder.buildEdmTypeField(
					"PhoneNumber1",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link phoneNumber2} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PHONE_NUMBER_2: fieldBuilder.buildEdmTypeField(
					"PhoneNumber2",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link teleboxNumber} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TELEBOX_NUMBER: fieldBuilder.buildEdmTypeField(
					"TeleboxNumber",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link telexNumber} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				TELEX_NUMBER: fieldBuilder.buildEdmTypeField(
					"TelexNumber",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link faxNumber} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				FAX_NUMBER: fieldBuilder.buildEdmTypeField(
					"FaxNumber",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link dataCommunicationPhoneNumber} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				DATA_COMMUNICATION_PHONE_NUMBER: fieldBuilder.buildEdmTypeField(
					"DataCommunicationPhoneNumber",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterPrinterName} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_PRINTER_NAME: fieldBuilder.buildEdmTypeField(
					"ProfitCenterPrinterName",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterCreatedByUser} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_CREATED_BY_USER: fieldBuilder.buildEdmTypeField(
					"ProfitCenterCreatedByUser",
					"Edm.String",
					true,
				),
				/**
				 * Static representation of the {@link profitCenterCreationDate} property for query construction.
				 * Use to reference this property in query operations such as 'select' in the fluent request API.
				 */
				PROFIT_CENTER_CREATION_DATE: fieldBuilder.buildEdmTypeField(
					"ProfitCenterCreationDate",
					"Edm.DateTime",
					true,
				),
				...this.navigationPropertyFields,
				/**
				 *
				 * All fields selector.
				 */
				ALL_FIELDS: new AllFields("*", ProfitCenter),
			};
		}

		return this._schema;
	}
}
