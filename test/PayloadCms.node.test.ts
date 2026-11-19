import type { IDataObject, IExecuteFunctions, INode, INodeExecutionData } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearJwtCache } from '../nodes/PayloadCms/GenericFunctions';
import { PayloadCms } from '../nodes/PayloadCms/PayloadCms.node';

function createExecuteContext(
	params: Record<string, unknown>,
	options: {
		items?: INodeExecutionData[];
		httpRequest?: ReturnType<typeof vi.fn>;
		httpRequestWithAuthentication?: ReturnType<typeof vi.fn>;
		continueOnFail?: boolean;
		binaryBuffer?: Buffer;
	} = {},
): IExecuteFunctions {
	const items = options.items ?? [{ json: {} }];
	const httpRequest = options.httpRequest ?? vi.fn();
	const httpRequestWithAuthentication = options.httpRequestWithAuthentication ?? vi.fn();

	return {
		getInputData: vi.fn().mockReturnValue(items),
		getNode: vi.fn().mockReturnValue({ name: 'Payload CMS', type: 'n8n-nodes-payload-cms.payloadCms' } as INode),
		getNodeParameter: vi.fn((name: string, _itemIndex: number, fallback?: unknown) => {
			if (name in params) return params[name];
			return fallback;
		}),
		getCredentials: vi.fn().mockResolvedValue({
			baseUrl: 'https://cms.example.com',
			apiRoute: '/api',
			authCollection: 'users',
			apiKey: 'test-api-key',
		}),
		continueOnFail: vi.fn().mockReturnValue(Boolean(options.continueOnFail)),
		helpers: {
			httpRequest,
			httpRequestWithAuthentication,
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (
				inputData: INodeExecutionData[],
				meta: { itemData: { item: number } },
			) => inputData.map((d) => ({ ...d, pairedItem: meta.itemData })),
			assertBinaryData: vi.fn().mockReturnValue({
				fileName: 'hero.png',
				mimeType: 'image/png',
				data: 'aGVsbG8=',
			}),
			getBinaryDataBuffer: vi.fn().mockResolvedValue(options.binaryBuffer ?? Buffer.from('hello')),
			prepareBinaryData: vi.fn().mockImplementation(async (buf: Buffer, fileName: string, mimeType: string) => ({
				data: buf.toString('base64'),
				fileName,
				mimeType,
			})),
		},
	} as unknown as IExecuteFunctions;
}

describe('PayloadCms Node', () => {
	const node = new PayloadCms();

	beforeEach(() => {
		clearJwtCache();
	});

	it('has usableAsTool enabled and supports both API Key and JWT credentials', () => {
		expect(node.description.usableAsTool).toBe(true);
		const credNames = (node.description.credentials ?? []).map((c) => c.name);
		expect(credNames).toEqual(['payloadCmsApi', 'payloadCmsJwtApi']);
	});

	it('Collection -> getMany splits docs and passes where/locale/draft/depth/select params', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			docs: [
				{ id: '1', title: 'First Post' },
				{ id: '2', title: 'Second Post' },
			],
			totalDocs: 2,
			hasNextPage: false,
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'collection',
				operation: 'getMany',
				collection: 'posts',
				returnAll: false,
				limit: 10,
				filterMode: 'builder',
				filterCombinator: 'and',
				filters: {
					conditions: [{ field: 'status', operator: 'equals', value: 'published' }],
				},
				options: {
					depth: 2,
					locale: 'en',
					fallbackLocale: 'none',
					draft: true,
					select: 'title,slug',
					sort: '-createdAt',
				},
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);

		expect(output).toHaveLength(2);
		expect(output[0]).toEqual({ json: { id: '1', title: 'First Post' }, pairedItem: { item: 0 } });
		const calledUrl = decodeURIComponent(httpRequestWithAuthentication.mock.calls[0][1].url);
		expect(calledUrl).toContain('https://cms.example.com/api/posts?');
		expect(calledUrl).toContain('where[status][equals]=published');
		expect(calledUrl).toContain('depth=2');
		expect(calledUrl).toContain('locale=en');
		expect(calledUrl).toContain('fallback-locale=none');
		expect(calledUrl).toContain('draft=true');
		expect(calledUrl).toContain('select[title]=true');
		expect(calledUrl).toContain('sort=-createdAt');
		expect(calledUrl).toContain('limit=10');
	});

	it('Collection -> create supports Fields UI with JSON value parsing', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			doc: { id: '10', title: 'Hello', views: 42 },
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'collection',
				operation: 'create',
				collection: 'posts',
				dataInputMode: 'fields',
				fieldsUi: {
					fieldValues: [
						{ fieldName: 'title', fieldValue: 'Hello', parseJson: false },
						{ fieldName: 'views', fieldValue: '42', parseJson: true },
						{ fieldName: 'tags', fieldValue: '["cms","n8n"]', parseJson: true },
					],
				},
				options: { draft: true },
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({ doc: { id: '10', title: 'Hello', views: 42 } });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'payloadCmsApi',
			expect.objectContaining({
				method: 'POST',
				body: { title: 'Hello', views: 42, tags: ['cms', 'n8n'] },
			}),
		);
	});

	it('Collection -> updateMany rejects empty filter for safety', async () => {
		const ctx = createExecuteContext({
			authentication: 'apiKey',
			resource: 'collection',
			operation: 'updateMany',
			collection: 'posts',
			filterMode: 'json',
			whereJson: '{}',
			dataInputMode: 'json',
			bodyJson: '{"status":"archived"}',
		});

		await expect(node.execute.call(ctx)).rejects.toThrow(/filter.*required/i);
	});

	it('Collection -> count queries /count endpoint with where filter', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({ totalDocs: 17 });
		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'collection',
				operation: 'count',
				collection: 'posts',
				filterMode: 'json',
				whereJson: '{"status":{"equals":"published"}}',
				options: { locale: 'en' },
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({ totalDocs: 17 });
		expect(decodeURIComponent(httpRequestWithAuthentication.mock.calls[0][1].url)).toContain(
			'/api/posts/count?locale=en&where[status][equals]=published',
		);
	});

	it('Global -> get & update use /api/globals/:slug', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			siteName: 'My Payload Site',
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'global',
				operation: 'update',
				globalSlug: 'site-settings',
				dataInputMode: 'json',
				bodyJson: '{"siteName":"My Payload Site"}',
				options: { locale: 'en' },
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({ siteName: 'My Payload Site' });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'payloadCmsApi',
			expect.objectContaining({
				method: 'POST',
				url: 'https://cms.example.com/api/globals/site-settings?locale=en',
				body: { siteName: 'My Payload Site' },
			}),
		);
	});

	it('Media -> upload sends FormData with file and _payload metadata', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			doc: { id: 'm1', filename: 'hero.png', alt: 'Hero Banner' },
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'media',
				operation: 'upload',
				collection: 'media',
				binaryPropertyName: 'data',
				metadataJson: '{"alt":"Hero Banner"}',
				options: {},
			},
			{ httpRequestWithAuthentication, binaryBuffer: Buffer.from('png-bytes') },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({
			doc: { id: 'm1', filename: 'hero.png', alt: 'Hero Banner' },
		});

		const sentBody = httpRequestWithAuthentication.mock.calls[0][1].body as FormData;
		expect(sentBody).toBeInstanceOf(FormData);
		expect(sentBody.get('_payload')).toBe('{"alt":"Hero Banner"}');
		expect(sentBody.get('file')).toBeTruthy();
	});

	it('Media -> download fetches metadata and downloads requested imageSize binary', async () => {
		const httpRequestWithAuthentication = vi
			.fn()
			.mockResolvedValueOnce({
				id: 'm1',
				filename: 'hero.png',
				mimeType: 'image/png',
				url: '/api/media/file/hero.png',
				sizes: {
					thumbnail: {
						filename: 'hero-thumb.png',
						mimeType: 'image/png',
						url: '/api/media/file/hero-thumb.png',
					},
				},
			})
			.mockResolvedValueOnce(Buffer.from('thumb-bytes'));

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'media',
				operation: 'download',
				collection: 'media',
				documentId: 'm1',
				outputBinaryPropertyName: 'image',
				options: { imageSize: 'thumbnail' },
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].binary?.image?.fileName).toBe('hero-thumb.png');
		expect(httpRequestWithAuthentication.mock.calls[1][1].url).toBe(
			'https://cms.example.com/api/media/file/hero-thumb.png',
		);
	});

	it('Auth -> login calls POST /api/:authCollection/login without auth header', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			token: 'abc.def.ghi',
			user: { id: 'u1', email: 'editor@example.com' },
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'auth',
				operation: 'login',
				authCollection: 'admins',
				email: 'editor@example.com',
				password: 'secret',
				options: {},
			},
			{ httpRequest },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({
			token: 'abc.def.ghi',
			user: { id: 'u1', email: 'editor@example.com' },
		});
		expect(httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				url: 'https://cms.example.com/api/admins/login',
				body: { email: 'editor@example.com', password: 'secret' },
			}),
		);
	});

	it('returns error item with pairedItem when continueOnFail is enabled', async () => {
		const httpRequestWithAuthentication = vi.fn().mockRejectedValue(new Error('Network down'));
		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'collection',
				operation: 'get',
				collection: { mode: 'list', value: 'posts' },
				documentId: '123',
			},
			{ httpRequestWithAuthentication, continueOnFail: true },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].pairedItem).toEqual({ item: 0 });
		expect(output[0].json.error).toBeDefined();
	});

	it('Custom Endpoint -> POST sends body, query params, Payload options, and custom headers', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			ok: true,
			revalidated: ['/blog'],
		});

		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'endpoint',
				operation: 'post',
				endpointPath: '/api/revalidate',
				bodyJson: '{"paths":["/blog"]}',
				queryParameters: {
					parameters: [{ name: 'secret', value: 'abc' }],
				},
				options: {
					locale: 'en',
					headers: {
						headerValues: [{ name: 'X-Source', value: 'n8n' }],
					},
				},
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({ ok: true, revalidated: ['/blog'] });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'payloadCmsApi',
			expect.objectContaining({
				method: 'POST',
				url: 'https://cms.example.com/api/revalidate?locale=en&secret=abc',
				body: { paths: ['/blog'] },
				headers: expect.objectContaining({ 'X-Source': 'n8n' }),
			}),
		);
	});

	it('Custom Endpoint -> GET wraps array response cleanly in { data }', async () => {
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue(['item1', 'item2']);
		const ctx = createExecuteContext(
			{
				authentication: 'apiKey',
				resource: 'endpoint',
				operation: 'get',
				endpointPath: 'custom-list',
				queryParameters: {},
				options: {},
			},
			{ httpRequestWithAuthentication },
		);

		const [output] = await node.execute.call(ctx);
		expect(output[0].json).toEqual({ data: ['item1', 'item2'] });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'payloadCmsApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://cms.example.com/api/custom-list',
			}),
		);
	});
});
