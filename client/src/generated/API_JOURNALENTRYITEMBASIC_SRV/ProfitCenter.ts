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
import type { ProfitCenterApi } from './ProfitCenterApi.js';

/**
 * This class represents the entity "A_ProfitCenter" of service "API_JOURNALENTRYITEMBASIC_SRV".
 */
export class ProfitCenter<T extends DeSerializers = DefaultDeSerializers>
  extends Entity
  implements ProfitCenterType<T>
{
  /**
   * Technical entity name for ProfitCenter.
   */
  static override _entityName = 'A_ProfitCenter';
  /**
   * Default url path for the according service.
   */
  static override _defaultBasePath =
    '/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';
  /**
   * All key fields of the ProfitCenter entity.
   */
  static _keys = ['ControllingArea', 'ProfitCenter', 'ValidityEndDate'];
  /**
   * Controlling Area.
   * Maximum length: 4.
   */
  declare controllingArea: DeserializedType<T, 'Edm.String'>;
  /**
   * Profit Center.
   * Maximum length: 10.
   */
  declare profitCenter: DeserializedType<T, 'Edm.String'>;
  /**
   * Valid To Date.
   */
  declare validityEndDate: DeserializedType<T, 'Edm.DateTime'>;
  /**
   * Person Responsible for Profit Center.
   * Maximum length: 20.
   * @nullable
   */
  declare profitCtrResponsiblePersonName?: DeserializedType<
    T,
    'Edm.String'
  > | null;
  /**
   * Company Code.
   * Maximum length: 4.
   * @nullable
   */
  declare companyCode?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * User Responsible for the Profit Center.
   * Maximum length: 12.
   * @nullable
   */
  declare profitCtrResponsibleUser?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Valid-From Date.
   * @nullable
   */
  declare validityStartDate?: DeserializedType<T, 'Edm.DateTime'> | null;
  /**
   * Department.
   * Maximum length: 12.
   * @nullable
   */
  declare department?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Profit center area.
   * Maximum length: 12.
   * @nullable
   */
  declare profitCenterStandardHierarchy?: DeserializedType<
    T,
    'Edm.String'
  > | null;
  /**
   * Segment for Segmental Reporting.
   * Maximum length: 10.
   * @nullable
   */
  declare segment?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Lock indicator.
   * Maximum length: 1.
   * @nullable
   */
  declare profitCenterIsBlocked?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Template for Formula Planning in Profit Centers.
   * Maximum length: 10.
   * @nullable
   */
  declare formulaPlanningTemplate?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Title.
   * Maximum length: 15.
   * @nullable
   */
  declare formOfAddress?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Name.
   * Maximum length: 35.
   * @nullable
   */
  declare addressName?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Name 2.
   * Maximum length: 35.
   * @nullable
   */
  declare additionalName?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Name 3.
   * Maximum length: 35.
   * @nullable
   */
  declare profitCenterAddrName3?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Name 4.
   * Maximum length: 35.
   * @nullable
   */
  declare profitCenterAddrName4?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Street and House Number.
   * Maximum length: 35.
   * @nullable
   */
  declare streetAddressName?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * PO Box.
   * Maximum length: 10.
   * @nullable
   */
  declare poBox?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * City.
   * Maximum length: 35.
   * @nullable
   */
  declare cityName?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Postal Code.
   * Maximum length: 10.
   * @nullable
   */
  declare postalCode?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * District.
   * Maximum length: 35.
   * @nullable
   */
  declare district?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Country/Region Key.
   * Maximum length: 3.
   * @nullable
   */
  declare country?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Region (State, Province, County).
   * Maximum length: 3.
   * @nullable
   */
  declare region?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Tax Jurisdiction.
   * Maximum length: 15.
   * @nullable
   */
  declare taxJurisdiction?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Language Key.
   * Maximum length: 2.
   * @nullable
   */
  declare language?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * First telephone number.
   * Maximum length: 16.
   * @nullable
   */
  declare phoneNumber1?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Second telephone number.
   * Maximum length: 16.
   * @nullable
   */
  declare phoneNumber2?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Telebox Number.
   * Maximum length: 15.
   * @nullable
   */
  declare teleboxNumber?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Telex Number.
   * Maximum length: 30.
   * @nullable
   */
  declare telexNumber?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Fax Number.
   * Maximum length: 31.
   * @nullable
   */
  declare faxNumber?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Data communication line no.
   * Maximum length: 14.
   * @nullable
   */
  declare dataCommunicationPhoneNumber?: DeserializedType<
    T,
    'Edm.String'
  > | null;
  /**
   * Printer name for profit center.
   * Maximum length: 4.
   * @nullable
   */
  declare profitCenterPrinterName?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Entered By.
   * Maximum length: 12.
   * @nullable
   */
  declare profitCenterCreatedByUser?: DeserializedType<T, 'Edm.String'> | null;
  /**
   * Entered On.
   * @nullable
   */
  declare profitCenterCreationDate?: DeserializedType<T, 'Edm.DateTime'> | null;

  constructor(_entityApi: ProfitCenterApi<T>) {
    super(_entityApi);
  }
}

export interface ProfitCenterType<
  T extends DeSerializers = DefaultDeSerializers
> {
  controllingArea: DeserializedType<T, 'Edm.String'>;
  profitCenter: DeserializedType<T, 'Edm.String'>;
  validityEndDate: DeserializedType<T, 'Edm.DateTime'>;
  profitCtrResponsiblePersonName?: DeserializedType<T, 'Edm.String'> | null;
  companyCode?: DeserializedType<T, 'Edm.String'> | null;
  profitCtrResponsibleUser?: DeserializedType<T, 'Edm.String'> | null;
  validityStartDate?: DeserializedType<T, 'Edm.DateTime'> | null;
  department?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterStandardHierarchy?: DeserializedType<T, 'Edm.String'> | null;
  segment?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterIsBlocked?: DeserializedType<T, 'Edm.String'> | null;
  formulaPlanningTemplate?: DeserializedType<T, 'Edm.String'> | null;
  formOfAddress?: DeserializedType<T, 'Edm.String'> | null;
  addressName?: DeserializedType<T, 'Edm.String'> | null;
  additionalName?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterAddrName3?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterAddrName4?: DeserializedType<T, 'Edm.String'> | null;
  streetAddressName?: DeserializedType<T, 'Edm.String'> | null;
  poBox?: DeserializedType<T, 'Edm.String'> | null;
  cityName?: DeserializedType<T, 'Edm.String'> | null;
  postalCode?: DeserializedType<T, 'Edm.String'> | null;
  district?: DeserializedType<T, 'Edm.String'> | null;
  country?: DeserializedType<T, 'Edm.String'> | null;
  region?: DeserializedType<T, 'Edm.String'> | null;
  taxJurisdiction?: DeserializedType<T, 'Edm.String'> | null;
  language?: DeserializedType<T, 'Edm.String'> | null;
  phoneNumber1?: DeserializedType<T, 'Edm.String'> | null;
  phoneNumber2?: DeserializedType<T, 'Edm.String'> | null;
  teleboxNumber?: DeserializedType<T, 'Edm.String'> | null;
  telexNumber?: DeserializedType<T, 'Edm.String'> | null;
  faxNumber?: DeserializedType<T, 'Edm.String'> | null;
  dataCommunicationPhoneNumber?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterPrinterName?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterCreatedByUser?: DeserializedType<T, 'Edm.String'> | null;
  profitCenterCreationDate?: DeserializedType<T, 'Edm.DateTime'> | null;
}
