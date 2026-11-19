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
		displayName: 'Global',
		name: 'globalSlug',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['global'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a global...',
				typeOptions: {
					searchListMethod: 'searchGlobals',
					searchable: true,
				},
			},
			{
				displayName: 'By Slug',
				name: 'slug',
				type: 'string',
				placeholder: 'site-settings',
			},
		],
		description: 'The Payload CMS global (auto-discovered via /api/access or entered by slug)',
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
