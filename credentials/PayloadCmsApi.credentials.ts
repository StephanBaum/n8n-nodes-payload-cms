import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class PayloadCmsApi implements ICredentialType {
	name = 'payloadCmsApi';

	displayName = 'Payload CMS API';

	icon: Icon = {
		light: 'file:../nodes/PayloadCms/payloadcms.svg',
		dark: 'file:../nodes/PayloadCms/payloadcms.dark.svg',
	};

	documentationUrl = 'https://payloadcms.com/docs/authentication/api-keys';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:3000',
			placeholder: 'https://cms.example.com',
			required: true,
			description: 'Base URL of your Payload CMS instance (without trailing /api)',
		},
		{
			displayName: 'API Route Prefix',
			name: 'apiRoute',
			type: 'string',
			default: '/api',
			placeholder: '/api',
			description: 'REST API route prefix configured in payload.config.ts (default: /api)',
		},
		{
			displayName: 'Auth Collection Slug',
			name: 'authCollection',
			type: 'string',
			default: 'users',
			placeholder: 'users',
			required: true,
			description: 'Slug of the auth-enabled collection used for API key authentication (e.g., users)',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description:
				'API key generated in the Payload Admin Panel (requires auth.useAPIKey: true on the auth collection)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.authCollection + " API-Key " + $credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.baseUrl.replace(/\\/+$/, "")}}{{$credentials.apiRoute ? ($credentials.apiRoute.startsWith("/") ? $credentials.apiRoute.replace(/\\/+$/, "") : "/" + $credentials.apiRoute.replace(/\\/+$/, "")) : "/api"}}',
			url: '=/{{$credentials.authCollection}}/me',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'user',
					value: null,
					message:
						'Authentication failed: Payload CMS returned no authenticated user. Verify your API key and Auth Collection slug.',
				},
			},
		],
	};
}
