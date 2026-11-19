import type { INodeProperties } from 'n8n-workflow';

export const whereOperatorOptions: INodeProperties['options'] = [
	{
		name: 'All (Array Contains All)',
		value: 'all',
	},
	{
		name: 'Contains (Case-Insensitive)',
		value: 'contains',
	},
	{
		name: 'Equals',
		value: 'equals',
	},
	{
		name: 'Exists',
		value: 'exists',
	},
	{
		name: 'Greater Than',
		value: 'greater_than',
	},
	{
		name: 'Greater Than or Equal',
		value: 'greater_than_equal',
	},
	{
		name: 'In (Comma-Separated List)',
		value: 'in',
	},
	{
		name: 'Intersects (GeoJSON)',
		value: 'intersects',
	},
	{
		name: 'Less Than',
		value: 'less_than',
	},
	{
		name: 'Less Than or Equal',
		value: 'less_than_equal',
	},
	{
		name: 'Like (All Words Present)',
		value: 'like',
	},
	{
		name: 'Near (Point)',
		value: 'near',
	},
	{
		name: 'Not Equals',
		value: 'not_equals',
	},
	{
		name: 'Not In (Comma-Separated List)',
		value: 'not_in',
	},
	{
		name: 'Within (GeoJSON)',
		value: 'within',
	},
];

export const sharedPayloadOptionFields: INodeProperties[] = [
	{
		displayName: 'Depth',
		name: 'depth',
		type: 'number',
		default: 1,
		typeOptions: {
			minValue: 0,
			maxValue: 10,
		},
		description: 'Depth of relationship population (0 returns only IDs)',
	},
	{
		displayName: 'Draft',
		name: 'draft',
		type: 'boolean',
		default: false,
		description: 'Whether to include or write draft documents when versions/drafts are enabled',
	},
	{
		displayName: 'Fallback Locale',
		name: 'fallbackLocale',
		type: 'string',
		default: '',
		placeholder: 'en',
		description: 'Fallback locale code when a localized field is missing (set to "none" to disable fallback)',
	},
	{
		displayName: 'Locale',
		name: 'locale',
		type: 'string',
		default: '',
		placeholder: 'en',
		description: 'Locale code to retrieve or update localized fields (use "all" for all locales)',
	},
];

export const sharedReadOptionFields: INodeProperties[] = [
	...sharedPayloadOptionFields,
	{
		displayName: 'Select Fields',
		name: 'select',
		type: 'string',
		default: '',
		placeholder: 'title,slug,status',
		description: 'Comma-separated list of fields to include in the response (Payload v3 select syntax)',
	},
];

export function createWhereFilterParameters(
	resource: string,
	operations: string[],
	required = false,
): INodeProperties[] {
	return [
		{
			displayName: 'Filter Mode',
			name: 'filterMode',
			type: 'options',
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
				},
			},
			options: [
				...(required
					? []
					: [
							{
								name: 'None',
								value: 'none',
							},
						]),
				{
					name: 'Filter Builder',
					value: 'builder',
				},
				{
					name: 'JSON Where Query',
					value: 'json',
				},
			],
			default: required ? 'builder' : 'none',
			description: 'How to filter documents using Payload where queries',
		},
		{
			displayName: 'Combine Filters With',
			name: 'filterCombinator',
			type: 'options',
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
					filterMode: ['builder'],
				},
			},
			options: [
				{
					name: 'AND (All Conditions Match)',
					value: 'and',
				},
				{
					name: 'OR (Any Condition Matches)',
					value: 'or',
				},
			],
			default: 'and',
			description: 'Logical operator used to combine multiple filter conditions',
		},
		{
			displayName: 'Filters',
			name: 'filters',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Filter',
			default: {},
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
					filterMode: ['builder'],
				},
			},
			options: [
				{
					displayName: 'Condition',
					name: 'conditions',
					values: [
						{
							displayName: 'Field',
							name: 'field',
							type: 'string',
							default: '',
							required: true,
							placeholder: 'status or author.email',
							description: 'Field path to filter on (dot notation supported for nested fields)',
						},
						{
							displayName: 'Operator',
							name: 'operator',
							type: 'options',
							options: whereOperatorOptions,
							default: 'equals',
							description: 'Payload comparison operator',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							description:
								'Comparison value (use comma-separated values for in/not_in/all, or true/false for exists)',
						},
					],
				},
			],
		},
		{
			displayName: 'Where Query (JSON)',
			name: 'whereJson',
			type: 'json',
			default: '{\n  "status": {\n    "equals": "published"\n  }\n}',
			required,
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
					filterMode: ['json'],
				},
			},
			description: 'Raw Payload CMS where query object in JSON format',
		},
	];
}

export function createDocumentDataParameters(
	resource: string,
	operations: string[],
	fieldLabel = 'Document Data',
): INodeProperties[] {
	return [
		{
			displayName: 'Data Input Mode',
			name: 'dataInputMode',
			type: 'options',
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
				},
			},
			options: [
				{
					name: 'Fields',
					value: 'fields',
				},
				{
					name: 'JSON',
					value: 'json',
				},
			],
			default: 'json',
			description: 'Whether to provide fields using a key/value list or raw JSON',
		},
		{
			displayName: fieldLabel,
			name: 'bodyJson',
			type: 'json',
			default: '{}',
			required: true,
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
					dataInputMode: ['json'],
				},
			},
			description: 'JSON object containing the fields to send to Payload CMS',
		},
		{
			displayName: 'Fields',
			name: 'fieldsUi',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Field',
			default: {},
			displayOptions: {
				show: {
					resource: [resource],
					operation: operations,
					dataInputMode: ['fields'],
				},
			},
			options: [
				{
					displayName: 'Field',
					name: 'fieldValues',
					values: [
						{
							displayName: 'Field Name',
							name: 'fieldName',
							type: 'string',
							default: '',
							required: true,
							description: 'Name of the field in the Payload schema',
						},
						{
							displayName: 'Field Value',
							name: 'fieldValue',
							type: 'string',
							default: '',
							description:
								'Value for the field (valid JSON objects, arrays, numbers, or booleans are automatically parsed when Parse JSON Values is enabled)',
						},
						{
							displayName: 'Parse Value as JSON',
							name: 'parseJson',
							type: 'boolean',
							default: false,
							description: 'Whether to parse the field value as JSON (useful for numbers, booleans, arrays, or nested objects)',
						},
					],
				},
			],
		},
	];
}
