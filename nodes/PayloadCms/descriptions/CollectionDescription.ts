import type { INodeProperties } from 'n8n-workflow';
import {
	createDocumentDataParameters,
	createWhereFilterParameters,
	sharedPayloadOptionFields,
	sharedReadOptionFields,
} from './SharedParameters';

export const collectionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['collection'],
			},
		},
		options: [
			{
				name: 'Count',
				value: 'count',
				description: 'Count documents matching an optional query',
				action: 'Count documents in a collection',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new document in a collection',
				action: 'Create a document',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a document by ID',
				action: 'Delete a document',
			},
			{
				name: 'Delete Many',
				value: 'deleteMany',
				description: 'Bulk delete documents matching a query',
				action: 'Delete many documents',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single document by ID',
				action: 'Get a document',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Find and query multiple documents in a collection',
				action: 'Get many documents',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a document by ID',
				action: 'Update a document',
			},
			{
				name: 'Update Many',
				value: 'updateMany',
				description: 'Bulk update documents matching a query',
				action: 'Update many documents',
			},
		],
		default: 'getMany',
	},
];

export const collectionFields: INodeProperties[] = [
	{
		displayName: 'Collection',
		name: 'collection',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['collection'],
			},
		},
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
			'The Payload CMS collection (auto-discovered via /api/access or entered by slug)',
	},
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the document',
	},

	// Get Many pagination controls
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['getMany'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['getMany'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},

	// Optional Where filters for Get Many & Count
	...createWhereFilterParameters('collection', ['getMany', 'count'], false),

	// Required Where filters for Bulk Update & Bulk Delete
	...createWhereFilterParameters('collection', ['updateMany', 'deleteMany'], true),

	// Document data input for Create, Update, Update Many
	...createDocumentDataParameters('collection', ['create', 'update', 'updateMany'], 'Document Data'),

	// Additional options for Get Many
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['getMany'],
			},
		},
		options: [
			...sharedReadOptionFields,
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 1,
				},
				description: 'Page number to retrieve (ignored when Return All is enabled)',
			},
			{
				displayName: 'Return Full Response',
				name: 'returnFullResponse',
				type: 'boolean',
				default: false,
				description:
					'Whether to return the full Payload pagination envelope (docs, totalDocs, page, hasNextPage) instead of splitting docs into separate items',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				placeholder: '-createdAt',
				description: 'Field to sort by (prefix with "-" for descending order, e.g., -createdAt)',
			},
		],
	},

	// Additional options for Get by ID
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['get'],
			},
		},
		options: [...sharedReadOptionFields],
	},

	// Additional options for Create & Update Many
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['create', 'updateMany'],
			},
		},
		options: [...sharedPayloadOptionFields],
	},

	// Additional options for Update by ID
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Autosave',
				name: 'autosave',
				type: 'boolean',
				default: false,
				description: 'Whether to save the update as an autosave draft version',
			},
			...sharedPayloadOptionFields,
		],
	},

	// Additional options for Delete & Delete Many
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['delete', 'deleteMany'],
			},
		},
		options: [
			{
				displayName: 'Depth',
				name: 'depth',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 0,
					maxValue: 10,
				},
				description: 'Depth of relationship population in the returned deleted document(s)',
			},
			{
				displayName: 'Fallback Locale',
				name: 'fallbackLocale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Fallback locale code when a localized field is missing',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Locale code for returned document fields',
			},
		],
	},

	// Additional options for Count
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collection'],
				operation: ['count'],
			},
		},
		options: [
			{
				displayName: 'Draft',
				name: 'draft',
				type: 'boolean',
				default: false,
				description: 'Whether to include draft documents in the count',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Locale code to evaluate localized query filters against',
			},
		],
	},
];
