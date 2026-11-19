import type {
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class PayloadCmsJwtApi implements ICredentialType {
	name = 'payloadCmsJwtApi';

	displayName = 'Payload CMS Email & Password (JWT) API';

	icon: Icon = {
		light: 'file:../nodes/PayloadCms/payloadcms.svg',
		dark: 'file:../nodes/PayloadCms/payloadcms.dark.svg',
	};

	documentationUrl = 'https://payloadcms.com/docs/authentication/overview';

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
			description: 'Slug of the auth-enabled collection used for login (e.g., users)',
		},
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			default: '',
			placeholder: 'admin@example.com',
			required: true,
			description: 'Email address of the Payload CMS user',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Password of the Payload CMS user',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.baseUrl.replace(/\\/+$/, "")}}{{$credentials.apiRoute ? ($credentials.apiRoute.startsWith("/") ? $credentials.apiRoute.replace(/\\/+$/, "") : "/" + $credentials.apiRoute.replace(/\\/+$/, "")) : "/api"}}',
			url: '=/{{$credentials.authCollection}}/login',
			method: 'POST',
			body: {
				email: '={{$credentials.email}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
