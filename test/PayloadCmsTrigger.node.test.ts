import type { IDataObject, INode, IPollFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { PayloadCmsTrigger } from '../nodes/PayloadCms/PayloadCmsTrigger.node';

function createPollContext(
	params: Record<string, unknown>,
	options: {
		mode?: 'manual' | 'trigger';
		staticData?: IDataObject;
		httpRequestWithAuthentication?: ReturnType<typeof vi.fn>;
	} = {},
): { ctx: IPollFunctions; staticData: IDataObject; httpRequestWithAuthentication: ReturnType<typeof vi.fn> } {
	const staticData: IDataObject = options.staticData ?? {};
	const httpRequestWithAuthentication = options.httpRequestWithAuthentication ?? vi.fn();

	const ctx = {
		getMode: vi.fn().mockReturnValue(options.mode ?? 'trigger'),
		getNode: vi
			.fn()
			.mockReturnValue({ name: 'Payload CMS Trigger', type: 'n8n-nodes-payload-cms.payloadCmsTrigger' } as INode),
		getNodeParameter: vi.fn((name: string, fallback?: unknown) => {
			if (name in params) return params[name];
			return fallback;
		}),
		getCredentials: vi.fn().mockResolvedValue({
			baseUrl: 'https://cms.example.com',
			apiRoute: '/api',
			authCollection: 'users',
			apiKey: 'test-api-key',
		}),
		getWorkflowStaticData: vi.fn().mockReturnValue(staticData),
		helpers: {
			httpRequest: vi.fn(),
			httpRequestWithAuthentication,
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
		},
	} as unknown as IPollFunctions;

	return { ctx, staticData, httpRequestWithAuthentication };
}

describe('PayloadCmsTrigger Node', () => {
	const trigger = new PayloadCmsTrigger();

	it('returns most recent docs immediately in manual test mode', async () => {
		const { ctx, httpRequestWithAuthentication } = createPollContext(
			{
				authentication: 'apiKey',
				collection: 'posts',
				event: 'created',
				options: { limit: 5 },
			},
			{
				mode: 'manual',
				httpRequestWithAuthentication: vi.fn().mockResolvedValue({
					docs: [{ id: 'p2', title: 'Latest' }],
				}),
			},
		);

		const result = await trigger.poll.call(ctx);
		expect(result).toEqual([[{ json: { id: 'p2', title: 'Latest' } }]]);
		expect(decodeURIComponent(httpRequestWithAuthentication.mock.calls[0][1].url)).toContain(
			'sort=-createdAt',
		);
	});

	it('initializes watermark on first production poll without flooding old docs', async () => {
		const { ctx, staticData, httpRequestWithAuthentication } = createPollContext({
			authentication: 'apiKey',
			collection: 'posts',
			event: 'created',
			options: {},
		});

		const result = await trigger.poll.call(ctx);
		expect(result).toBeNull();
		expect(typeof staticData.lastTimeChecked).toBe('string');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('emits newly created docs and deduplicates boundary timestamp IDs', async () => {
		const staticData: IDataObject = {
			lastTimeChecked: '2026-11-19T12:00:00.000Z',
			seenIdsAtTimestamp: ['p1'],
		};
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			docs: [
				{ id: 'p1', createdAt: '2026-11-19T12:00:00.000Z', title: 'Already Seen' },
				{ id: 'p2', createdAt: '2026-11-19T12:00:00.000Z', title: 'Same Millisecond New' },
				{ id: 'p3', createdAt: '2026-11-19T12:05:00.000Z', title: 'Newer Post' },
			],
		});

		const { ctx } = createPollContext(
			{
				authentication: 'apiKey',
				collection: 'posts',
				event: 'created',
				options: {
					whereJson: '{"status":{"equals":"published"}}',
				},
			},
			{ staticData, httpRequestWithAuthentication },
		);

		const result = await trigger.poll.call(ctx);
		expect(result?.[0].map((item) => item.json.id)).toEqual(['p2', 'p3']);
		expect(staticData.lastTimeChecked).toBe('2026-11-19T12:05:00.000Z');
		expect(staticData.seenIdsAtTimestamp).toEqual(['p3']);

		const calledUrl = decodeURIComponent(httpRequestWithAuthentication.mock.calls[0][1].url);
		expect(calledUrl).toContain('where[and][0][createdAt][greater_than_equal]=2026-11-19T12:00:00.000Z');
		expect(calledUrl).toContain('where[and][1][status][equals]=published');
	});

	it('filters out brand-new docs when event is "updated" only', async () => {
		const staticData: IDataObject = {
			lastTimeChecked: '2026-11-19T12:00:00.000Z',
			seenIdsAtTimestamp: [],
		};
		const httpRequestWithAuthentication = vi.fn().mockResolvedValue({
			docs: [
				{
					id: 'new-doc',
					createdAt: '2026-11-19T12:01:00.000Z',
					updatedAt: '2026-11-19T12:01:00.000Z',
				},
				{
					id: 'edited-doc',
					createdAt: '2026-11-18T10:00:00.000Z',
					updatedAt: '2026-11-19T12:02:00.000Z',
				},
			],
		});

		const { ctx } = createPollContext(
			{
				authentication: 'apiKey',
				collection: 'posts',
				event: 'updated',
				options: {},
			},
			{ staticData, httpRequestWithAuthentication },
		);

		const result = await trigger.poll.call(ctx);
		expect(result?.[0].map((item) => item.json.id)).toEqual(['edited-doc']);
	});
});
