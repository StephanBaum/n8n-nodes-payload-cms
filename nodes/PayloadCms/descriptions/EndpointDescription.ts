import type { INodeProperties } from 'n8n-workflow';
import { sharedPayloadOptionFields } from './SharedParameters';

export const endpointOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['endpoint'],
			},
		},
		options: [
			{
				name: 'DELETE',
				value: 'delete',
				description: 'Send a DELETE request to a custom Payload CMS endpoint',
				action: 'Send a DELETE request to a custom endpoint',
			},
			{
				name: 'GET',
				value: 'get',
				description: 'Send a GET request to a custom Payload CMS endpoint',
				action: 'Send a GET request to a custom endpoint',
			},
			{
				name: 'PATCH',
				value: 'patch',
				description: 'Send a PATCH request to a custom Payload CMS endpoint',
				action: 'Send a PATCH request to a custom endpoint',
			},
			{
				name: 'POST',
				value: 'post',
				description: 'Send a POST request to a custom Payload CMS endpoint',
				action: 'Send a POST request to a custom endpoint',
			},
			{
				name: 'PUT',
				value: 'put',
				description: 'Send a PUT request to a custom Payload CMS endpoint',
				action: 'Send a PUT request to a custom endpoint',
			},
		],
		default: 'get',
	},
];

export const endpointFields: INodeProperties[] = [
	{
		displayName: 'Endpoint Path',
		name: 'endpointPath',
		type: 'string',
		required: true,
		default: '',
		placeholder: '/custom-route or /posts/publish-all',
		displayOptions: {
			show: {
				resource: ['endpoint'],
			},
		},
		description:
			'Path of the custom Payload REST endpoint relative to your API Route Prefix (e.g., /health or /posts/123/duplicate)',
	},
	{
		displayName: 'Request Body (JSON)',
		name: 'bodyJson',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['endpoint'],
				operation: ['post', 'put', 'patch', 'delete'],
			},
		},
		description: 'JSON payload to send in the request body',
	},
	{
		displayName: 'Query Parameters',
		name: 'queryParameters',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Query Parameter',
		default: {},
		displayOptions: {
			show: {
				resource: ['endpoint'],
			},
		},
		options: [
			{
				displayName: 'Parameter',
				name: 'parameters',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description: 'Query parameter name',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Query parameter value',
					},
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['endpoint'],
			},
		},
		options: [
			...sharedPayloadOptionFields,
			{
				displayName: 'Custom Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Header',
				default: {},
				options: [
					{
						displayName: 'Header',
						name: 'headerValues',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'X-Custom-Header',
								description: 'HTTP header name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'HTTP header value',
							},
						],
					},
				],
			},
			{
				displayName: 'Return Full Response',
				name: 'returnFullResponse',
				type: 'boolean',
				default: false,
				description: 'Whether to return the full HTTP response including status code and headers',
			},
		],
	},
];
