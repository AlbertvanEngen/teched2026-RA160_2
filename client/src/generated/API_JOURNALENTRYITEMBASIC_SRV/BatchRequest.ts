/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
  CreateRequestBuilder,
  DeleteRequestBuilder,
  DeSerializers,
  GetAllRequestBuilder,
  GetByKeyRequestBuilder,
  ODataBatchRequestBuilder,
  UpdateRequestBuilder,
  BatchChangeSet
} from '@sap-cloud-sdk/odata-v2';
import { transformVariadicArgumentToArray } from '@sap-cloud-sdk/util';
import {
  CompanyCode,
  CostCenter,
  GlAccountInChartOfAccounts,
  JournalEntryItemBasic,
  ProfitCenter
} from './index.js';

/**
 * Batch builder for operations supported on the Api Journalentryitembasic Srv.
 * @param requests The requests of the batch.
 * @returns A request builder for batch.
 */
export function batch<DeSerializersT extends DeSerializers>(
  ...requests: Array<
    | ReadApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
  requests: Array<
    | ReadApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT>;
export function batch<DeSerializersT extends DeSerializers>(
  first:
    | undefined
    | ReadApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
    | Array<
        | ReadApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
        | BatchChangeSet<DeSerializersT>
      >,
  ...rest: Array<
    | ReadApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
    | BatchChangeSet<DeSerializersT>
  >
): ODataBatchRequestBuilder<DeSerializersT> {
  return new ODataBatchRequestBuilder(
    defaultApiJournalentryitembasicSrvPath,
    transformVariadicArgumentToArray(first, rest)
  );
}

/**
 * Change set constructor consists of write operations supported on the Api Journalentryitembasic Srv.
 * @param requests The requests of the change set.
 * @returns A change set for batch.
 */
export function changeset<DeSerializersT extends DeSerializers>(
  ...requests: Array<
    WriteApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
  >
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
  requests: Array<
    WriteApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
  >
): BatchChangeSet<DeSerializersT>;
export function changeset<DeSerializersT extends DeSerializers>(
  first:
    | undefined
    | WriteApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>
    | Array<WriteApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>>,
  ...rest: Array<WriteApiJournalentryitembasicSrvRequestBuilder<DeSerializersT>>
): BatchChangeSet<DeSerializersT> {
  return new BatchChangeSet(transformVariadicArgumentToArray(first, rest));
}

export const defaultApiJournalentryitembasicSrvPath =
  '/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';
export type ReadApiJournalentryitembasicSrvRequestBuilder<
  DeSerializersT extends DeSerializers
> =
  | GetAllRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
  | GetAllRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
  | GetAllRequestBuilder<
      GlAccountInChartOfAccounts<DeSerializersT>,
      DeSerializersT
    >
  | GetAllRequestBuilder<JournalEntryItemBasic<DeSerializersT>, DeSerializersT>
  | GetAllRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
  | GetByKeyRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
  | GetByKeyRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
  | GetByKeyRequestBuilder<
      GlAccountInChartOfAccounts<DeSerializersT>,
      DeSerializersT
    >
  | GetByKeyRequestBuilder<
      JournalEntryItemBasic<DeSerializersT>,
      DeSerializersT
    >
  | GetByKeyRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>;
export type WriteApiJournalentryitembasicSrvRequestBuilder<
  DeSerializersT extends DeSerializers
> =
  | CreateRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<CompanyCode<DeSerializersT>, DeSerializersT>
  | CreateRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<CostCenter<DeSerializersT>, DeSerializersT>
  | CreateRequestBuilder<
      GlAccountInChartOfAccounts<DeSerializersT>,
      DeSerializersT
    >
  | UpdateRequestBuilder<
      GlAccountInChartOfAccounts<DeSerializersT>,
      DeSerializersT
    >
  | DeleteRequestBuilder<
      GlAccountInChartOfAccounts<DeSerializersT>,
      DeSerializersT
    >
  | CreateRequestBuilder<JournalEntryItemBasic<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<JournalEntryItemBasic<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<JournalEntryItemBasic<DeSerializersT>, DeSerializersT>
  | CreateRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
  | UpdateRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>
  | DeleteRequestBuilder<ProfitCenter<DeSerializersT>, DeSerializersT>;
