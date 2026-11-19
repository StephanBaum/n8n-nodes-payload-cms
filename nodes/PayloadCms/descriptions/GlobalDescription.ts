import type { INodeProperties } from 'n8n-workflow';
import {
	createDocumentDataParameters,
	sharedPayloadOptionFields,
	sharedReadOptionFields,
} from './SharedParameters';

export const globalOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['global'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a global document',
				action: 'Get a global',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a global document',
				action: 'Update a global',
			},
		],
		default: 'get',
	},
];

export const globalFields: INodeProperties[] = [
	{
		displayName: 'Global Slug',
		name: 'globalSlug',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'site-settings',
		displayOptions: {
			show: {
				resource: ['global'],
			},
		},
		description: 'The slug of the Payload CMS global (e.g., header, footer, site-settings)',
	},

	...createDocumentDataParameters('global', ['update'], 'Global Data'),

	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['global'],
				operation: ['get'],
			},
		},
		options: [...sharedReadOptionFields],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['global'],
				operation: ['update'],
			},
		},
		options: [...sharedPayloadOptionFields],
	},
];
