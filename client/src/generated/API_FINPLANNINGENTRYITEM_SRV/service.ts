/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import { CompanyCodeApi } from './CompanyCodeApi.js';
import { CostCenterApi } from './CostCenterApi.js';
import { FinPlanEntryItemVariableFixApi } from './FinPlanEntryItemVariableFixApi.js';
import { FinPlanningEntryItemApi } from './FinPlanningEntryItemApi.js';
import { GlAccountInChartOfAccountsApi } from './GlAccountInChartOfAccountsApi.js';
import { ProfitCenterApi } from './ProfitCenterApi.js';
import BigNumber from 'bignumber.js';
import { Moment } from 'moment';
import {
  defaultDeSerializers,
  DeSerializers,
  DefaultDeSerializers,
  mergeDefaultDeSerializersWith,
  Time
} from '@sap-cloud-sdk/odata-v2';
import { batch, changeset } from './BatchRequest.js';

export function apiFinplanningentryitemSrv<
  BinaryT = string,
  BooleanT = boolean,
  ByteT = number,
  DecimalT = BigNumber,
  DoubleT = number,
  FloatT = number,
  Int16T = number,
  Int32T = number,
  Int64T = BigNumber,
  GuidT = string,
  SByteT = number,
  SingleT = number,
  StringT = string,
  AnyT = any,
  DateTimeOffsetT = Moment,
  DateTimeT = Moment,
  TimeT = Time
>(
  deSerializers: Partial<
    DeSerializers<
      BinaryT,
      BooleanT,
      ByteT,
      DecimalT,
      DoubleT,
      FloatT,
      Int16T,
      Int32T,
      Int64T,
      GuidT,
      SByteT,
      SingleT,
      StringT,
      AnyT,
      DateTimeOffsetT,
      DateTimeT,
      TimeT
    >
  > = defaultDeSerializers as any
): ApiFinplanningentryitemSrv<
  DeSerializers<
    BinaryT,
    BooleanT,
    ByteT,
    DecimalT,
    DoubleT,
    FloatT,
    Int16T,
    Int32T,
    Int64T,
    GuidT,
    SByteT,
    SingleT,
    StringT,
    AnyT,
    DateTimeOffsetT,
    DateTimeT,
    TimeT
  >
> {
  return new ApiFinplanningentryitemSrv(
    mergeDefaultDeSerializersWith(deSerializers)
  );
}
class ApiFinplanningentryitemSrv<
  DeSerializersT extends DeSerializers = DefaultDeSerializers
> {
  private apis: Record<string, any> = {};
  private deSerializers: DeSerializersT;

  constructor(deSerializers: DeSerializersT) {
    this.deSerializers = deSerializers;
  }

  private initApi(key: string, entityApi: any): any {
    if (!this.apis[key]) {
      this.apis[key] = entityApi._privateFactory(this.deSerializers);
    }
    return this.apis[key];
  }

  get companyCodeApi(): CompanyCodeApi<DeSerializersT> {
    return this.initApi('companyCodeApi', CompanyCodeApi);
  }

  get costCenterApi(): CostCenterApi<DeSerializersT> {
    return this.initApi('costCenterApi', CostCenterApi);
  }

  get finPlanEntryItemVariableFixApi(): FinPlanEntryItemVariableFixApi<DeSerializersT> {
    return this.initApi(
      'finPlanEntryItemVariableFixApi',
      FinPlanEntryItemVariableFixApi
    );
  }

  get finPlanningEntryItemApi(): FinPlanningEntryItemApi<DeSerializersT> {
    const api = this.initApi(
      'finPlanningEntryItemApi',
      FinPlanningEntryItemApi
    );
    const linkedApis = [
      this.initApi('companyCodeApi', CompanyCodeApi),
      this.initApi('costCenterApi', CostCenterApi),
      this.initApi('profitCenterApi', ProfitCenterApi),
      this.initApi(
        'glAccountInChartOfAccountsApi',
        GlAccountInChartOfAccountsApi
      )
    ];
    api._addNavigationProperties(linkedApis);
    return api;
  }

  get glAccountInChartOfAccountsApi(): GlAccountInChartOfAccountsApi<DeSerializersT> {
    return this.initApi(
      'glAccountInChartOfAccountsApi',
      GlAccountInChartOfAccountsApi
    );
  }

  get profitCenterApi(): ProfitCenterApi<DeSerializersT> {
    return this.initApi('profitCenterApi', ProfitCenterApi);
  }

  get batch(): typeof batch {
    return batch;
  }

  get changeset(): typeof changeset {
    return changeset;
  }
}
