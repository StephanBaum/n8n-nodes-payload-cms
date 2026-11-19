import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPayloadCredentials } from '../nodes/PayloadCms/GenericFunctions';
import {
	applyPayloadOptionsToQuery,
	buildApiBaseUrl,
	buildOriginUrl,
	buildWhereFromFilters,
	clearJwtCache,
	parseSelectFields,
	payloadApiRequest,
	payloadApiRequestAllItems,
	serializeQueryParams,
} from '../nodes/PayloadCms/GenericFunctions';

function createMockContext(
	credentials: IPayloadCredentials,
	overrides: Partial<{
		httpRequest: ReturnType<typeof vi.fn>;
		httpRequestWithAuthentication: ReturnType<typeof vi.fn>;
	}> = {},
): IExecuteFunctions {
	const httpRequest = overrides.httpRequest ?? vi.fn();
	const httpRequestWithAuthentication = overrides.httpRequestWithAuthentication ?? vi.fn();

	return {
		getInputData: vi.fn().mockReturnValue([{ json: {} }]),
		getNode: vi.fn().mockReturnValue({ name: 'Payload CMS', type: 'n8n-nodes-payload-cms.payloadCms' } as INode),
		getNodeParameter: vi.fn((name: string) => {
			if (name === 'authentication') return credentials.authenticationType;
			return undefined;
		}),
		getCredentials: vi.fn().mockResolvedValue(credentials),
		helpers: {
			httpRequest,
			httpRequestWithAuthentication,
		},
	} as unknown as IExecuteFunctions;
}

describe('GenericFunctions', () => {
	beforeEach(() => {
		clearJwtCache();
	});

	describe('buildApiBaseUrl & buildOriginUrl', () => {
		it('combines baseUrl and default /api route cleanly', () => {
			expect(
				buildApiBaseUrl({
					baseUrl: 'https://cms.example.com/',
					authCollection: 'users',
					authenticationType: 'apiKey',
				}),
			).toBe('https://cms.example.com/api');
		});

		it('does not duplicate /api when already included in baseUrl', () => {
			expect(
				buildApiBaseUrl({
					baseUrl: 'https://cms.example.com/api/',
					apiRoute: '/api',
					authCollection: 'users',
					authenticationType: 'apiKey',
				}),
			).toBe('https://cms.example.com/api');
		});

		it('supports custom apiRoute without leading slash', () => {
			expect(
				buildApiBaseUrl({
					baseUrl: 'http://localhost:3000',
					apiRoute: 'cms-api/',
					authCollection: 'admins',
					authenticationType: 'apiKey',
				}),
			).toBe('http://localhost:3000/cms-api');
		});

		it('resolves origin URL by stripping trailing apiRoute', () => {
			expect(
				buildOriginUrl({
					baseUrl: 'https://cms.example.com/api/',
					apiRoute: '/api',
					authCollection: 'users',
					authenticationType: 'apiKey',
				}),
			).toBe('https://cms.example.com');
		});
	});

	describe('serializeQueryParams', () => {
		it('serializes nested where clauses and preserves boolean false & numeric 0', () => {
			const qs = serializeQueryParams({
				depth: 0,
				draft: false,
				where: {
					or: [
						{ title: { contains: 'Payload CMS' } },
						{ status: { equals: 'published' } },
					],
				},
			});

			const decoded = decodeURIComponent(qs);
			expect(decoded).toContain('depth=0');
			expect(decoded).toContain('draft=false');
			expect(decoded).toContain('where[or][0][title][contains]=Payload CMS');
			expect(decoded).toContain('where[or][1][status][equals]=published');
		});

		it('omits undefined, null, and empty string top-level params', () => {
			const qs = serializeQueryParams({
				locale: '',
				sort: undefined,
				limit: 10,
			});
			expect(qs).toBe('limit=10');
		});
	});

	describe('parseSelectFields', () => {
		it('parses comma-separated fields including nested dot paths and exclusions', () => {
			expect(parseSelectFields('title, meta.description, -secretNotes')).toEqual({
				title: true,
				meta: { description: true },
				secretNotes: false,
			});
		});

		it('accepts raw JSON select object', () => {
			expect(parseSelectFields('{"title": true, "author": {"email": true}}')).toEqual({
				title: true,
				author: { email: true },
			});
		});
	});

	describe('buildWhereFromFilters', () => {
		it('returns single clause directly for single AND condition', () => {
			expect(
				buildWhereFromFilters([{ field: 'status', operator: 'equals', value: 'published' }], 'and'),
			).toEqual({
				status: { equals: 'published' },
			});
		});

		it('combines multiple conditions with OR and parses special operators', () => {
			const where = buildWhereFromFilters(
				[
					{ field: 'tags', operator: 'in', value: 'news, updates, cms' },
					{ field: 'featuredImage', operator: 'exists', value: 'false' },
				],
				'or',
			);

			expect(where).toEqual({
				or: [
					{ tags: { in: ['news', 'updates', 'cms'] } },
					{ featuredImage: { exists: false } },
				],
			});
		});
	});

	describe('applyPayloadOptionsToQuery', () => {
		it('maps fallbackLocale to fallback-locale and parses select', () => {
			const qs: Record<string, unknown> = {};
			applyPayloadOptionsToQuery(qs, {
				depth: 2,
				draft: true,
				locale: 'de',
				fallbackLocale: 'en',
				select: 'title,slug',
				sort: '-createdAt',
				page: 3,
				autosave: true,
			});

			expect(qs).toEqual({
				depth: 2,
				draft: true,
				locale: 'de',
				'fallback-locale': 'en',
				select: { title: true, slug: true },
				sort: '-createdAt',
				page: 3,
				autosave: true,
			});
		});
	});

	describe('payloadApiRequest authentication & pagination', () => {
		it('uses httpRequestWithAuthentication for API Key credentials', async () => {
			const httpRequestWithAuthentication = vi.fn().mockResolvedValue({ id: '1', title: 'Hello' });
			const ctx = createMockContext(
				{
					baseUrl: 'https://cms.example.com',
					apiRoute: '/api',
					authCollection: 'users',
					authenticationType: 'apiKey',
					apiKey: 'secret-key',
				},
				{ httpRequestWithAuthentication },
			);

			const result = await payloadApiRequest.call(ctx, 'GET', '/posts/1', undefined, { depth: 2 });

			expect(result).toEqual({ id: '1', title: 'Hello' });
			expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
				'payloadCmsApi',
				expect.objectContaining({
					method: 'GET',
					url: 'https://cms.example.com/api/posts/1?depth=2',
				}),
			);
		});

		it('authenticates via JWT login, caches token, and refreshes once on 401', async () => {
			const httpRequest = vi
				.fn()
				// 1. Initial login
				.mockResolvedValueOnce({ token: 'jwt-1', exp: Math.floor(Date.now() / 1000) + 3600 })
				// 2. First GET returns 401 (simulating invalidated token)
				.mockRejectedValueOnce({ statusCode: 401, message: 'Unauthorized' })
				// 3. Forced re-login
				.mockResolvedValueOnce({ token: 'jwt-2', exp: Math.floor(Date.now() / 1000) + 3600 })
				// 4. Retried GET succeeds
				.mockResolvedValueOnce({ docs: [{ id: 'p1' }] });

			const ctx = createMockContext(
				{
					baseUrl: 'https://cms.example.com',
					apiRoute: '/api',
					authCollection: 'users',
					authenticationType: 'jwt',
					email: 'admin@example.com',
					password: 'secret',
				},
				{ httpRequest },
			);

			const res = await payloadApiRequest.call(ctx, 'GET', '/posts');
			expect(res).toEqual({ docs: [{ id: 'p1' }] });
			expect(httpRequest).toHaveBeenCalledTimes(4);
			expect(httpRequest.mock.calls[3][0].headers.Authorization).toBe('JWT jwt-2');
		});

		it('paginates through all pages in payloadApiRequestAllItems', async () => {
			const httpRequestWithAuthentication = vi
				.fn()
				.mockResolvedValueOnce({
					docs: [{ id: '1' }, { id: '2' }],
					hasNextPage: true,
					nextPage: 2,
					page: 1,
					totalPages: 2,
					totalDocs: 3,
				})
				.mockResolvedValueOnce({
					docs: [{ id: '3' }],
					hasNextPage: false,
					nextPage: null,
					page: 2,
					totalPages: 2,
					totalDocs: 3,
				});

			const ctx = createMockContext(
				{
					baseUrl: 'https://cms.example.com',
					authCollection: 'users',
					authenticationType: 'apiKey',
					apiKey: 'secret-key',
				},
				{ httpRequestWithAuthentication },
			);

			const docs = await payloadApiRequestAllItems.call(ctx, '/posts');
			expect(docs).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
			expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
		});
	});
});
