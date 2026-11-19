import type { INodeProperties } from 'n8n-workflow';
import { sharedPayloadOptionFields } from './SharedParameters';

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['media'],
			},
		},
		options: [
			{
				name: 'Download',
				value: 'download',
				description: 'Download a file from an upload-enabled collection into binary data',
				action: 'Download a media file',
			},
			{
				name: 'Update File',
				value: 'updateFile',
				description: 'Replace the file and/or metadata of an existing media document',
				action: 'Update a media file',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload a binary file to an upload-enabled collection',
				action: 'Upload a media file',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	{
		displayName: 'Upload Collection',
		name: 'collection',
		type: 'resourceLocator',
		default: { mode: 'slug', value: 'media' },
		required: true,
		displayOptions: {
			show: {
				resource: ['media'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select an upload collection...',
				typeOptions: {
					searchListMethod: 'searchCollections',
					searchable: true,
				},
			},
			{
				displayName: 'By Slug',
				name: 'slug',
				type: 'string',
				placeholder: 'media',
			},
		],
		description:
			'The upload-enabled Payload CMS collection (default: media, or auto-discovered via /api/access)',
	},
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['media'],
				operation: ['updateFile', 'download'],
			},
		},
		description: 'The ID of the media document',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['media'],
				operation: ['upload', 'updateFile'],
			},
		},
		description: 'Name of the binary property containing the file to upload',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'outputBinaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['media'],
				operation: ['download'],
			},
		},
		description: 'Name of the binary property to store the downloaded file in',
	},
	{
		displayName: 'Metadata (JSON)',
		name: 'metadataJson',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['media'],
				operation: ['upload', 'updateFile'],
			},
		},
		description:
			'Optional additional fields (such as alt text or caption) sent as the _payload JSON field alongside the file',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['media'],
				operation: ['upload', 'updateFile'],
			},
		},
		options: [
			...sharedPayloadOptionFields,
			{
				displayName: 'File Name Override',
				name: 'fileName',
				type: 'string',
				default: '',
				placeholder: 'hero-image.png',
				description: 'Optional custom filename to use instead of the binary property filename',
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
				resource: ['media'],
				operation: ['download'],
			},
		},
		options: [
			{
				displayName: 'Image Size',
				name: 'imageSize',
				type: 'string',
				default: '',
				placeholder: 'thumbnail',
				description:
					'Optional Payload image size name (from doc.sizes.<name>.url) to download instead of the original file',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Locale code used when fetching the media document metadata',
			},
		],
	},
];
