/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import {
	type DefaultDeSerializers,
	type DeSerializers,
	type DeserializedType,
	GetAllRequestBuilder,
	GetByKeyRequestBuilder,
	RequestBuilder,
} from "@sap-cloud-sdk/odata-v2";
import type { JournalEntryItemBasic } from "./JournalEntryItemBasic.ts";

/**
 * Request builder class for operations supported on the {@link JournalEntryItemBasic} entity.
 */
export class JournalEntryItemBasicRequestBuilder<
	T extends DeSerializers = DefaultDeSerializers,
> extends RequestBuilder<JournalEntryItemBasic<T>, T> {
	/**
	 * Returns a request builder for querying all `JournalEntryItemBasic` entities.
	 * @returns A request builder for creating requests to retrieve all `JournalEntryItemBasic` entities.
	 */
	getAll(): GetAllRequestBuilder<JournalEntryItemBasic<T>, T> {
		return new GetAllRequestBuilder<JournalEntryItemBasic<T>, T>(
			this.entityApi,
		);
	}

	/**
	 * Returns a request builder for retrieving one `JournalEntryItemBasic` entity based on its keys.
	 * @param id Key property. See {@link JournalEntryItemBasic.id}.
	 * @returns A request builder for creating requests to retrieve one `JournalEntryItemBasic` entity based on its keys.
	 */
	getByKey(
		id: DeserializedType<T, "Edm.String">,
	): GetByKeyRequestBuilder<JournalEntryItemBasic<T>, T> {
		return new GetByKeyRequestBuilder<JournalEntryItemBasic<T>, T>(
			this.entityApi,
			{ ID: id },
		);
	}
}
