import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { sharedReadOptionFields } from './descriptions/SharedParameters';
import type { IPayloadPaginatedResponse } from './GenericFunctions';
import {
	applyPayloadOptionsToQuery,
	extractResourceLocatorValue,
	parseJsonObject,
	payloadApiRequest,
	searchPayloadCollections,
} from './GenericFunctions';

interface ITriggerStaticData {
	lastTimeChecked?: string;
	seenIdsAtTimestamp?: string[];
}

export class PayloadCmsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Payload CMS Trigger',
		name: 'payloadCmsTrigger',
		icon: {
			light: 'file:payloadcms.svg',
			dark: 'file:payloadcms.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"] + " in " + ($parameter["collection"]?.value || $parameter["collection"])}}',
		description: 'Triggers when documents are created or updated in a Payload CMS collection',
		defaults: {
			name: 'Payload CMS Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'payloadCmsApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
			},
			{
				name: 'payloadCmsJwtApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['jwt'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
					{
						name: 'Email & Password (JWT)',
						value: 'jwt',
					},
				],
				default: 'apiKey',
				description: 'Authentication method to connect to Payload CMS',
			},
			{
				displayName: 'Collection',
				name: 'collection',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a collection...',
						typeOptions: {
							searchListMethod: 'searchCollections',
							searchable: true,
						},
					},
					{
						displayName: 'By Slug',
						name: 'slug',
						type: 'string',
						placeholder: 'posts',
					},
				],
				description:
					'The Payload CMS collection to poll for changes (auto-discovered via /api/access or entered by slug)',
			},
			{
				displayName: 'Trigger Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Document Created',
						value: 'created',
						description: 'Triggers when a new document is created in the collection',
					},
					{
						name: 'Document Created or Updated',
						value: 'createdOrUpdated',
						description: 'Triggers when a document is created or updated in the collection',
					},
					{
						name: 'Document Updated',
						value: 'updated',
						description: 'Triggers when an existing document is updated in the collection',
					},
				],
				default: 'created',
				description: 'Event type to monitor in the collection',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					...sharedReadOptionFields,
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						default: 50,
						typeOptions: {
							minValue: 1,
							maxValue: 500,
						},
						description: 'Max number of results to return per poll',
					},
					{
						displayName: 'Where Filter (JSON)',
						name: 'whereJson',
						type: 'json',
						default: '',
						placeholder: '{"status": {"equals": "published"}}',
						description:
							'Optional Payload where query object to restrict which documents trigger the workflow',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			searchCollections: searchPayloadCollections,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const collection = extractResourceLocatorValue(this.getNodeParameter('collection'));
		if (!collection) {
			throw new NodeOperationError(this.getNode(), 'Collection is required');
		}

		const event = this.getNodeParameter('event', 'created') as
			| 'created'
			| 'updated'
			| 'createdOrUpdated';
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const whereRaw = (options.whereJson ?? '') as string | IDataObject;

		const timestampField = event === 'created' ? 'createdAt' : 'updatedAt';
		const limit = typeof options.limit === 'number' ? options.limit : 50;

		let additionalWhere: IDataObject | undefined;
		if (typeof whereRaw === 'string' ? whereRaw.trim() !== '' : Boolean(whereRaw)) {
			const parsed = parseJsonObject(this, whereRaw, 'Where Filter (JSON)');
			if (Object.keys(parsed).length > 0) {
				additionalWhere = parsed;
			}
		}

		const qs: IDataObject = {
			limit,
		};
		applyPayloadOptionsToQuery(qs, options);

		const encodedCollection = encodeURIComponent(collection);

		// In manual test mode, return the most recent matching documents immediately
		if (this.getMode() === 'manual') {
			qs.sort = `-${timestampField}`;
			if (additionalWhere) {
				qs.where = additionalWhere;
			}

			const response = (await payloadApiRequest.call(
				this,
				'GET',
				`/${encodedCollection}`,
				undefined,
				qs,
			)) as IPayloadPaginatedResponse;

			const docs = Array.isArray(response?.docs) ? response.docs : [];
			if (docs.length === 0) {
				return null;
			}

			return [this.helpers.returnJsonArray(docs)];
		}

		const staticData = this.getWorkflowStaticData('node') as unknown as ITriggerStaticData;
		const nowIso = new Date().toISOString();

		// First poll initializes the watermark so historical documents do not flood the workflow
		if (!staticData.lastTimeChecked) {
			staticData.lastTimeChecked = nowIso;
			staticData.seenIdsAtTimestamp = [];
			return null;
		}

		const timeClause: IDataObject = {
			[timestampField]: {
				greater_than_equal: staticData.lastTimeChecked,
			},
		};

		qs.where = additionalWhere ? { and: [timeClause, additionalWhere] } : timeClause;
		qs.sort = timestampField;

		const response = (await payloadApiRequest.call(
			this,
			'GET',
			`/${encodedCollection}`,
			undefined,
			qs,
		)) as IPayloadPaginatedResponse;

		const rawDocs = Array.isArray(response?.docs) ? response.docs : [];
		const previouslySeen = new Set(staticData.seenIdsAtTimestamp ?? []);

		const filteredDocs = rawDocs.filter((doc) => {
			const docId = doc.id !== undefined ? String(doc.id) : '';
			const docTimestamp = String(doc[timestampField] ?? '');

			// Skip documents already emitted at the exact previous watermark timestamp
			if (docTimestamp === staticData.lastTimeChecked && previouslySeen.has(docId)) {
				return false;
			}

			// For 'updated' only (excluding brand-new docs), require updatedAt > createdAt
			if (event === 'updated' && doc.createdAt && doc.updatedAt) {
				if (String(doc.updatedAt) === String(doc.createdAt)) {
					return false;
				}
			}

			return true;
		});

		if (filteredDocs.length === 0) {
			return null;
		}

		const newestTimestamp = String(
			filteredDocs[filteredDocs.length - 1][timestampField] ?? staticData.lastTimeChecked,
		);
		const idsAtNewest = filteredDocs
			.filter((doc) => String(doc[timestampField] ?? '') === newestTimestamp)
			.map((doc) => String(doc.id ?? ''))
			.filter(Boolean);

		if (newestTimestamp === staticData.lastTimeChecked) {
			staticData.seenIdsAtTimestamp = Array.from(new Set([...previouslySeen, ...idsAtNewest]));
		} else {
			staticData.lastTimeChecked = newestTimestamp;
			staticData.seenIdsAtTimestamp = idsAtNewest;
		}

		return [this.helpers.returnJsonArray(filteredDocs)];
	}
}
