/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import { CostCenter } from './CostCenter.js';
import { CostCenterRequestBuilder } from './CostCenterRequestBuilder.js';
import {
  CustomField,
  defaultDeSerializers,
  DefaultDeSerializers,
  DeSerializers,
  AllFields,
  entityBuilder,
  EntityBuilderType,
  EntityApi,
  FieldBuilder,
  OrderableEdmTypeField
} from '@sap-cloud-sdk/odata-v2';
export class CostCenterApi<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> implements EntityApi<CostCenter<DeSerializersT>, DeSerializersT> {
  public deSerializers: DeSerializersT;

  private constructor(
    deSerializers: DeSerializersT = defaultDeSerializers as any
  ) {
    this.deSerializers = deSerializers;
  }

  /**
   * Do not use this method or the constructor directly.
   * Use the service function as described in the documentation to get an API instance.
   */
  public static _privateFactory<
    DeSerializersT extends DeSerializers = DefaultDeSerializers
  >(
    deSerializers: DeSerializersT = defaultDeSerializers as any
  ): CostCenterApi<DeSerializersT> {
    return new CostCenterApi(deSerializers);
  }

  private navigationPropertyFields!: {};

  _addNavigationProperties(linkedApis: []): this {
    this.navigationPropertyFields = {};
    return this;
  }

  entityConstructor = CostCenter;

  requestBuilder(): CostCenterRequestBuilder<DeSerializersT> {
    return new CostCenterRequestBuilder<DeSerializersT>(this);
  }

  entityBuilder(): EntityBuilderType<
    CostCenter<DeSerializersT>,
    DeSerializersT
  > {
    return entityBuilder<CostCenter<DeSerializersT>, DeSerializersT>(this);
  }

  customField<NullableT extends boolean = false>(
    fieldName: string,
    isNullable: NullableT = false as NullableT
  ): CustomField<CostCenter<DeSerializersT>, DeSerializersT, NullableT> {
    return new CustomField(
      fieldName,
      this.entityConstructor,
      this.deSerializers,
      isNullable
    ) as any;
  }

  private _fieldBuilder?: FieldBuilder<typeof CostCenter, DeSerializersT>;
  get fieldBuilder() {
    if (!this._fieldBuilder) {
      this._fieldBuilder = new FieldBuilder(CostCenter, this.deSerializers);
    }
    return this._fieldBuilder;
  }

  private _schema?: {
    CONTROLLING_AREA: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    COST_CENTER: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      false,
      true
    >;
    VALIDITY_END_DATE: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.DateTime',
      false,
      true
    >;
    VALIDITY_START_DATE: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.DateTime',
      true,
      true
    >;
    COMPANY_CODE: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    BUSINESS_AREA: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CTR_RESPONSIBLE_PERSON_NAME: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CTR_RESPONSIBLE_USER: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CENTER_CURRENCY: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    PROFIT_CENTER: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    DEPARTMENT: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COSTING_SHEET: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    FUNCTIONAL_AREA: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COUNTRY: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    REGION: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    CITY_NAME: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CENTER_STANDARD_HIER_AREA: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CENTER_CATEGORY: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLKD_FOR_PRIMARY_COSTS_POSTING: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLKD_FOR_SECONDARY_COSTS_POSTING: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLOCKED_FOR_REVENUE_POSTING: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLOCKED_FOR_COMMITMENT_POSTING: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLOCKED_FOR_PLAN_PRIMARY_COSTS: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLOCKED_FOR_PLAN_SECONDARY_COSTS: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    IS_BLOCKED_FOR_PLAN_REVENUES: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    CONSUMPTION_QTY_IS_RECORDED: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    LANGUAGE: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CENTER_CREATED_BY_USER: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.String',
      true,
      true
    >;
    COST_CENTER_CREATION_DATE: OrderableEdmTypeField<
      CostCenter<DeSerializers>,
      DeSerializersT,
      'Edm.DateTime',
      true,
      true
    >;
    ALL_FIELDS: AllFields<CostCenter<DeSerializers>>;
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
          'ControllingArea',
          'Edm.String',
          false
        ),
        /**
         * Static representation of the {@link costCenter} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER: fieldBuilder.buildEdmTypeField(
          'CostCenter',
          'Edm.String',
          false
        ),
        /**
         * Static representation of the {@link validityEndDate} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        VALIDITY_END_DATE: fieldBuilder.buildEdmTypeField(
          'ValidityEndDate',
          'Edm.DateTime',
          false
        ),
        /**
         * Static representation of the {@link validityStartDate} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        VALIDITY_START_DATE: fieldBuilder.buildEdmTypeField(
          'ValidityStartDate',
          'Edm.DateTime',
          true
        ),
        /**
         * Static representation of the {@link companyCode} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COMPANY_CODE: fieldBuilder.buildEdmTypeField(
          'CompanyCode',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link businessArea} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        BUSINESS_AREA: fieldBuilder.buildEdmTypeField(
          'BusinessArea',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCtrResponsiblePersonName} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CTR_RESPONSIBLE_PERSON_NAME: fieldBuilder.buildEdmTypeField(
          'CostCtrResponsiblePersonName',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCtrResponsibleUser} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CTR_RESPONSIBLE_USER: fieldBuilder.buildEdmTypeField(
          'CostCtrResponsibleUser',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCenterCurrency} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER_CURRENCY: fieldBuilder.buildEdmTypeField(
          'CostCenterCurrency',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link profitCenter} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        PROFIT_CENTER: fieldBuilder.buildEdmTypeField(
          'ProfitCenter',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link department} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        DEPARTMENT: fieldBuilder.buildEdmTypeField(
          'Department',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costingSheet} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COSTING_SHEET: fieldBuilder.buildEdmTypeField(
          'CostingSheet',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link functionalArea} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        FUNCTIONAL_AREA: fieldBuilder.buildEdmTypeField(
          'FunctionalArea',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link country} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COUNTRY: fieldBuilder.buildEdmTypeField('Country', 'Edm.String', true),
        /**
         * Static representation of the {@link region} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        REGION: fieldBuilder.buildEdmTypeField('Region', 'Edm.String', true),
        /**
         * Static representation of the {@link cityName} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        CITY_NAME: fieldBuilder.buildEdmTypeField(
          'CityName',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCenterStandardHierArea} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER_STANDARD_HIER_AREA: fieldBuilder.buildEdmTypeField(
          'CostCenterStandardHierArea',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCenterCategory} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER_CATEGORY: fieldBuilder.buildEdmTypeField(
          'CostCenterCategory',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlkdForPrimaryCostsPosting} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLKD_FOR_PRIMARY_COSTS_POSTING: fieldBuilder.buildEdmTypeField(
          'IsBlkdForPrimaryCostsPosting',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlkdForSecondaryCostsPosting} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLKD_FOR_SECONDARY_COSTS_POSTING: fieldBuilder.buildEdmTypeField(
          'IsBlkdForSecondaryCostsPosting',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlockedForRevenuePosting} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLOCKED_FOR_REVENUE_POSTING: fieldBuilder.buildEdmTypeField(
          'IsBlockedForRevenuePosting',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlockedForCommitmentPosting} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLOCKED_FOR_COMMITMENT_POSTING: fieldBuilder.buildEdmTypeField(
          'IsBlockedForCommitmentPosting',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlockedForPlanPrimaryCosts} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLOCKED_FOR_PLAN_PRIMARY_COSTS: fieldBuilder.buildEdmTypeField(
          'IsBlockedForPlanPrimaryCosts',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlockedForPlanSecondaryCosts} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLOCKED_FOR_PLAN_SECONDARY_COSTS: fieldBuilder.buildEdmTypeField(
          'IsBlockedForPlanSecondaryCosts',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link isBlockedForPlanRevenues} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        IS_BLOCKED_FOR_PLAN_REVENUES: fieldBuilder.buildEdmTypeField(
          'IsBlockedForPlanRevenues',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link consumptionQtyIsRecorded} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        CONSUMPTION_QTY_IS_RECORDED: fieldBuilder.buildEdmTypeField(
          'ConsumptionQtyIsRecorded',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link language} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        LANGUAGE: fieldBuilder.buildEdmTypeField(
          'Language',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCenterCreatedByUser} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER_CREATED_BY_USER: fieldBuilder.buildEdmTypeField(
          'CostCenterCreatedByUser',
          'Edm.String',
          true
        ),
        /**
         * Static representation of the {@link costCenterCreationDate} property for query construction.
         * Use to reference this property in query operations such as 'select' in the fluent request API.
         */
        COST_CENTER_CREATION_DATE: fieldBuilder.buildEdmTypeField(
          'CostCenterCreationDate',
          'Edm.DateTime',
          true
        ),
        ...this.navigationPropertyFields,
        /**
         *
         * All fields selector.
         */
        ALL_FIELDS: new AllFields('*', CostCenter)
      };
    }

    return this._schema;
  }
}
