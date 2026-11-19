import type { INodeProperties } from 'n8n-workflow';

export const authOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['auth'],
			},
		},
		options: [
			{
				name: 'Get Current User',
				value: 'me',
				description: 'Retrieve the currently authenticated user',
				action: 'Get the current user',
			},
			{
				name: 'Login',
				value: 'login',
				description: 'Authenticate with email and password to obtain a JWT token',
				action: 'Log in to Payload CMS',
			},
			{
				name: 'Logout',
				value: 'logout',
				description: 'Log out the current authenticated session',
				action: 'Log out of Payload CMS',
			},
			{
				name: 'Refresh Token',
				value: 'refreshToken',
				description: 'Refresh an existing JWT authentication token',
				action: 'Refresh a JWT token',
			},
		],
		default: 'me',
	},
];

export const authFields: INodeProperties[] = [
	{
		displayName: 'Auth Collection Override',
		name: 'authCollection',
		type: 'string',
		default: '',
		placeholder: 'users',
		displayOptions: {
			show: {
				resource: ['auth'],
			},
		},
		description:
			'Optional auth collection slug override (defaults to the Auth Collection configured in your Payload CMS credentials)',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'name@email.com',
		displayOptions: {
			show: {
				resource: ['auth'],
				operation: ['login'],
			},
		},
		description: 'Email address of the user to log in',
	},
	{
		displayName: 'Password',
		name: 'password',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['auth'],
				operation: ['login'],
			},
		},
		description: 'Password of the user to log in',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['auth'],
				operation: ['me', 'login', 'refreshToken'],
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
				description: 'Depth of relationship population for the returned user document',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Locale code for localized user fields',
			},
		],
	},
];
