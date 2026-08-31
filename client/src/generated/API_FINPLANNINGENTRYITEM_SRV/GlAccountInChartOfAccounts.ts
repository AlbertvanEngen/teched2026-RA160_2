/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
  Entity,
  DefaultDeSerializers,
  DeSerializers,
  DeserializedType
} from '@sap-cloud-sdk/odata-v2';
import type { GlAccountInChartOfAccountsApi } from './GlAccountInChartOfAccountsApi.js';

/**
 * This class represents the entity "A_GLAccountInChartOfAccounts" of service "API_FINPLANNINGENTRYITEM_SRV".
 */
export class GlAccountInChartOfAccounts<
  T extends DeSerializers = DefaultDeSerializers
>
  extends Entity
  implements GlAccountInChartOfAccountsType<T>
{
  /**
   * Technical entity name for GlAccountInChartOfAccounts.
   */
  static override _entityName = 'A_GLAccountInChartOfAccounts';
  /**
   * Default url path for the according service.
   */
  static override _defaultBasePath =
    '/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV';
  /**
   * All key fields of the GlAccountInChartOfAccounts entity.
   */
  static _keys = ['ChartOfAccounts', 'GLAccount'];
  /**
   * Chart of Accounts.
   * Maximum length: 4.
   */
  declare chartOfAccounts: DeserializedType<T, 'Edm.String'>;
  /**
   * G/L Account Number.
   * Maximum length: 10.
   */
  declare glAccount: DeserializedType<T, 'Edm.String'>;
  /**
   * Is Balance Sheet Account.
   * @nullable
   */
  declare isBalanceSheetAccount?: DeserializedType<T, 'Edm.Boolean'> | null;
  /**
   * G/L Account Group.
   * Maximum length: 4.
   * @nullable
   */
  declare glAccountGroup?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Group Account Number.
   * Maximum length: 10.
   * @nullable
   */
  declare corporateGroupAccount?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * P&L statement account type.
   * Maximum length: 2.
   * @nullable
   */
  declare profitLossAccountType?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Number of the Sample Account.
   * Maximum length: 10.
   * @nullable
   */
  declare sampleGlAccount?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Indicator: Account Marked for Deletion?.
   * @nullable
   */
  declare accountIsMarkedForDeletion?: DeserializedType<
    T,
    'Edm.Boolean'
  > | null;
  /**
   * Indicator: Account Is Blocked for Creation ?.
   * @nullable
   */
  declare accountIsBlockedForCreation?: DeserializedType<
    T,
    'Edm.Boolean'
  > | null;
  /**
   * Indicator: Is Account Blocked for Posting?.
   * @nullable
   */
  declare accountIsBlockedForPosting?: DeserializedType<
    T,
    'Edm.Boolean'
  > | null;
  /**
   * Indicator: Account Blocked for Planning ?.
   * @nullable
   */
  declare accountIsBlockedForPlanning?: DeserializedType<
    T,
    'Edm.Boolean'
  > | null;
  /**
   * Company ID of Trading Partner.
   * Maximum length: 6.
   * @nullable
   */
  declare partnerCompany?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Functional Area.
   * Maximum length: 16.
   * @nullable
   */
  declare functionalArea?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Record Created On.
   * @nullable
   */
  declare creationDate?: DeserializedType<T, 'Edm.DateTime'> | null;
  /**
   * Name of Person who Created the Object.
   * Maximum length: 12.
   * @nullable
   */
  declare createdByUser?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * UTC Time Stamp in Short Form (YYYYMMDDhhmmss).
   * @nullable
   */
  declare lastChangeDateTime?: DeserializedType<T, 'Edm.DateTimeOffset'> | null;
  /**
   * Type of a General Ledger Account.
   * Maximum length: 1.
   * @nullable
   */
  declare glAccountType?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * G/L Account Number.
   * Maximum length: 10.
   * @nullable
   */
  declare glAccountExternal?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Indicator: Account is a balance sheet account?.
   * @nullable
   */
  declare isProfitLossAccount?: DeserializedType<T, 'Edm.Boolean'> | null;

  constructor(_entityApi: GlAccountInChartOfAccountsApi<T>) {
    super(_entityApi);
  }
}

export interface GlAccountInChartOfAccountsType<
  T extends DeSerializers = DefaultDeSerializers
> {
  chartOfAccounts: DeserializedType<T, 'Edm.String'>;
  glAccount: DeserializedType<T, 'Edm.String'>;
  isBalanceSheetAccount?: DeserializedType<T, 'Edm.Boolean'> | null;
  glAccountGroup?: DeserializedType<T, 'Edm.String'> | null;
  corporateGroupAccount?: DeserializedType<T, 'Edm.String'> | null;
  profitLossAccountType?: DeserializedType<T, 'Edm.String'> | null;
  sampleGlAccount?: DeserializedType<T, 'Edm.String'> | null;
  accountIsMarkedForDeletion?: DeserializedType<T, 'Edm.Boolean'> | null;
  accountIsBlockedForCreation?: DeserializedType<T, 'Edm.Boolean'> | null;
  accountIsBlockedForPosting?: DeserializedType<T, 'Edm.Boolean'> | null;
  accountIsBlockedForPlanning?: DeserializedType<T, 'Edm.Boolean'> | null;
  partnerCompany?: DeserializedType<T, 'Edm.String'> | null;
  functionalArea?: DeserializedType<T, 'Edm.String'> | null;
  creationDate?: DeserializedType<T, 'Edm.DateTime'> | null;
  createdByUser?: DeserializedType<T, 'Edm.String'> | null;
  lastChangeDateTime?: DeserializedType<T, 'Edm.DateTimeOffset'> | null;
  glAccountType?: DeserializedType<T, 'Edm.String'> | null;
  glAccountExternal?: DeserializedType<T, 'Edm.String'> | null;
  isProfitLossAccount?: DeserializedType<T, 'Edm.Boolean'> | null;
}
