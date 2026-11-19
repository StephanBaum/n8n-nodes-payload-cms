import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { authFields, authOperations } from './descriptions/AuthDescription';
import { collectionFields, collectionOperations } from './descriptions/CollectionDescription';
import { endpointFields, endpointOperations } from './descriptions/EndpointDescription';
import { globalFields, globalOperations } from './descriptions/GlobalDescription';
import { mediaFields, mediaOperations } from './descriptions/MediaDescription';
import type { IPayloadPaginatedResponse } from './GenericFunctions';
import {
	applyPayloadOptionsToQuery,
	clearJwtCache,
	extractResourceLocatorValue,
	getDocumentBodyFromParameters,
	getPayloadCredentials,
	getWhereFromParameters,
	normalizeEndpointPath,
	parseJsonObject,
	payloadApiRequest,
	payloadApiRequestAllItems,
	payloadDownloadMediaFile,
	searchPayloadCollections,
	searchPayloadFields,
	searchPayloadGlobals,
} from './GenericFunctions';

export class PayloadCms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Payload CMS',
		name: 'payloadCms',
		icon: {
			light: 'file:payloadcms.svg',
			dark: 'file:payloadcms.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Interact with Payload CMS REST API (Collections, Globals, Media, Auth, and Custom Endpoints)',
		defaults: {
			name: 'Payload CMS',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'payloadCmsApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
			},
			{
				name: 'payloadCmsJwtApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['jwt'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
					{
						name: 'Email & Password (JWT)',
						value: 'jwt',
					},
				],
				default: 'apiKey',
				description: 'Authentication method to connect to Payload CMS',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Auth',
						value: 'auth',
					},
					{
						name: 'Collection',
						value: 'collection',
					},
					{
						name: 'Custom Endpoint',
						value: 'endpoint',
					},
					{
						name: 'Global',
						value: 'global',
					},
					{
						name: 'Media',
						value: 'media',
					},
				],
				default: 'collection',
			},
			...collectionOperations,
			...collectionFields,
			...globalOperations,
			...globalFields,
			...mediaOperations,
			...mediaFields,
			...endpointOperations,
			...endpointFields,
			...authOperations,
			...authFields,
		],
	};

	methods = {
		listSearch: {
			searchCollections: searchPayloadCollections,
			searchGlobals: searchPayloadGlobals,
			searchFields: searchPayloadFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'collection') {
					const collection = extractResourceLocatorValue(this.getNodeParameter('collection', i));
					if (!collection) {
						throw new NodeOperationError(this.getNode(), 'Collection is required', {
							itemIndex: i,
						});
					}
					const encodedCollection = encodeURIComponent(collection);
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const qs: IDataObject = {};
					applyPayloadOptionsToQuery(qs, options);

					if (operation === 'getMany') {
						const where = getWhereFromParameters(this, i);
						if (where) {
							qs.where = where;
						}

						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const returnFullResponse = Boolean(options.returnFullResponse);

						if (returnAll) {
							const docs = await payloadApiRequestAllItems.call(
								this,
								`/${encodedCollection}`,
								qs,
							);
							if (returnFullResponse) {
								returnData.push({
									json: {
										docs,
										totalDocs: docs.length,
									},
									pairedItem: { item: i },
								});
							} else {
								const executionData = this.helpers.constructExecutionMetaData(
									this.helpers.returnJsonArray(docs),
									{ itemData: { item: i } },
								);
								returnData.push(...executionData);
							}
						} else {
							const limit = this.getNodeParameter('limit', i, 50) as number;
							qs.limit = limit;
							const response = (await payloadApiRequest.call(
								this,
								'GET',
								`/${encodedCollection}`,
								undefined,
								qs,
							)) as IPayloadPaginatedResponse;

							if (returnFullResponse) {
								returnData.push({
									json: response as unknown as IDataObject,
									pairedItem: { item: i },
								});
							} else {
								const docs = Array.isArray(response?.docs) ? response.docs : [];
								const executionData = this.helpers.constructExecutionMetaData(
									this.helpers.returnJsonArray(docs),
									{ itemData: { item: i } },
								);
								returnData.push(...executionData);
							}
						}
					} else if (operation === 'get') {
						const documentId = (this.getNodeParameter('documentId', i) as string).trim();
						const response = (await payloadApiRequest.call(
							this,
							'GET',
							`/${encodedCollection}/${encodeURIComponent(documentId)}`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'create') {
						const body = getDocumentBodyFromParameters(this, i);
						const response = (await payloadApiRequest.call(
							this,
							'POST',
							`/${encodedCollection}`,
							body,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'update') {
						const documentId = (this.getNodeParameter('documentId', i) as string).trim();
						const body = getDocumentBodyFromParameters(this, i);
						const response = (await payloadApiRequest.call(
							this,
							'PATCH',
							`/${encodedCollection}/${encodeURIComponent(documentId)}`,
							body,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'updateMany') {
						const where = getWhereFromParameters(this, i);
						if (!where || Object.keys(where).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'A filter (where query) is required for Update Many to prevent accidental updates to the entire collection',
								{ itemIndex: i },
							);
						}
						qs.where = where;
						const body = getDocumentBodyFromParameters(this, i);
						const response = (await payloadApiRequest.call(
							this,
							'PATCH',
							`/${encodedCollection}`,
							body,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'delete') {
						const documentId = (this.getNodeParameter('documentId', i) as string).trim();
						const response = (await payloadApiRequest.call(
							this,
							'DELETE',
							`/${encodedCollection}/${encodeURIComponent(documentId)}`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'deleteMany') {
						const where = getWhereFromParameters(this, i);
						if (!where || Object.keys(where).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'A filter (where query) is required for Delete Many to prevent accidental deletion of the entire collection',
								{ itemIndex: i },
							);
						}
						qs.where = where;
						const response = (await payloadApiRequest.call(
							this,
							'DELETE',
							`/${encodedCollection}`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'count') {
						const where = getWhereFromParameters(this, i);
						if (where) {
							qs.where = where;
						}
						const response = (await payloadApiRequest.call(
							this,
							'GET',
							`/${encodedCollection}/count`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'global') {
					const globalSlug = extractResourceLocatorValue(this.getNodeParameter('globalSlug', i));
					if (!globalSlug) {
						throw new NodeOperationError(this.getNode(), 'Global is required', {
							itemIndex: i,
						});
					}
					const encodedGlobal = encodeURIComponent(globalSlug);
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const qs: IDataObject = {};
					applyPayloadOptionsToQuery(qs, options);

					if (operation === 'get') {
						const response = (await payloadApiRequest.call(
							this,
							'GET',
							`/globals/${encodedGlobal}`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'update') {
						const body = getDocumentBodyFromParameters(this, i);
						const response = (await payloadApiRequest.call(
							this,
							'POST',
							`/globals/${encodedGlobal}`,
							body,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'media') {
					const collection =
						extractResourceLocatorValue(this.getNodeParameter('collection', i, 'media')) || 'media';
					const encodedCollection = encodeURIComponent(collection);
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const qs: IDataObject = {};
					applyPayloadOptionsToQuery(qs, options);

					if (operation === 'upload' || operation === 'updateFile') {
						const binaryPropertyName = this.getNodeParameter(
							'binaryPropertyName',
							i,
							'data',
						) as string;
						const metadataRaw = this.getNodeParameter('metadataJson', i, '{}');
						const metadata = parseJsonObject(this, metadataRaw, 'Metadata (JSON)', i);

						const binaryMetadata = this.helpers.assertBinaryData(i, binaryPropertyName);
						const binaryBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

						const fileName =
							(typeof options.fileName === 'string' && options.fileName.trim()) ||
							binaryMetadata.fileName ||
							'upload.bin';
						const mimeType = binaryMetadata.mimeType || 'application/octet-stream';

						const formData = new FormData();
						const fileBlob = new Blob([new Uint8Array(binaryBuffer)], { type: mimeType });
						formData.append('file', fileBlob, fileName);

						if (Object.keys(metadata).length > 0) {
							formData.append('_payload', JSON.stringify(metadata));
						}

						const endpoint =
							operation === 'updateFile'
								? `/${encodedCollection}/${encodeURIComponent((this.getNodeParameter('documentId', i) as string).trim())}`
								: `/${encodedCollection}`;
						const method = operation === 'updateFile' ? 'PATCH' : 'POST';

						const response = (await payloadApiRequest.call(this, method, endpoint, undefined, qs, {
							rawBody: formData,
						})) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'download') {
						const documentId = (this.getNodeParameter('documentId', i) as string).trim();
						const outputBinaryPropertyName = this.getNodeParameter(
							'outputBinaryPropertyName',
							i,
							'data',
						) as string;

						const doc = (await payloadApiRequest.call(
							this,
							'GET',
							`/${encodedCollection}/${encodeURIComponent(documentId)}`,
							undefined,
							qs,
						)) as IDataObject;

						const imageSize =
							typeof options.imageSize === 'string' ? options.imageSize.trim() : '';
						let fileUrl = doc.url as string | undefined;
						let fileName = (doc.filename as string | undefined) || `${documentId}.bin`;
						let mimeType = (doc.mimeType as string | undefined) || 'application/octet-stream';

						if (imageSize && doc.sizes && typeof doc.sizes === 'object') {
							const sizeEntry = (doc.sizes as IDataObject)[imageSize] as IDataObject | undefined;
							if (!sizeEntry || !sizeEntry.url) {
								throw new NodeOperationError(
									this.getNode(),
									`Image size "${imageSize}" was not found on media document "${documentId}"`,
									{ itemIndex: i },
								);
							}
							fileUrl = sizeEntry.url as string;
							fileName = (sizeEntry.filename as string | undefined) || fileName;
							mimeType = (sizeEntry.mimeType as string | undefined) || mimeType;
						}

						if (!fileUrl) {
							throw new NodeOperationError(
								this.getNode(),
								`Media document "${documentId}" does not contain a downloadable file URL`,
								{ itemIndex: i },
							);
						}

						const fileData = await payloadDownloadMediaFile.call(this, fileUrl);
						const binaryData = await this.helpers.prepareBinaryData(fileData, fileName, mimeType);

						returnData.push({
							json: doc,
							binary: {
								[outputBinaryPropertyName]: binaryData,
							},
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'endpoint') {
					const credentials = await getPayloadCredentials(this, i);
					const rawPath = (this.getNodeParameter('endpointPath', i) as string).trim();
					if (!rawPath) {
						throw new NodeOperationError(this.getNode(), 'Endpoint Path is required', {
							itemIndex: i,
						});
					}
					const normalizedPath = normalizeEndpointPath(rawPath, credentials.apiRoute);
					const method = operation.toUpperCase() as IHttpRequestMethods;

					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const qs: IDataObject = {};
					applyPayloadOptionsToQuery(qs, options);

					const queryParameters = this.getNodeParameter('queryParameters', i, {}) as {
						parameters?: Array<{ name: string; value: string }>;
					};
					for (const param of queryParameters.parameters ?? []) {
						const paramName = (param.name || '').trim();
						if (paramName) {
							qs[paramName] = param.value;
						}
					}

					const headers: IDataObject = {};
					const customHeaders = options.headers as
						| { headerValues?: Array<{ name: string; value: string }> }
						| undefined;
					for (const header of customHeaders?.headerValues ?? []) {
						const headerName = (header.name || '').trim();
						if (headerName) {
							headers[headerName] = header.value;
						}
					}

					let body: IDataObject | undefined;
					if (method !== 'GET') {
						const bodyRaw = this.getNodeParameter('bodyJson', i, '{}');
						const parsedBody = parseJsonObject(this, bodyRaw, 'Request Body (JSON)', i);
						if (Object.keys(parsedBody).length > 0) {
							body = parsedBody;
						}
					}

					const response = await payloadApiRequest.call(this, method, normalizedPath, body, qs, {
						headers,
						returnFullResponse: Boolean(options.returnFullResponse),
					});

					const normalizedOutput: IDataObject =
						response !== null && typeof response === 'object' && !Array.isArray(response)
							? (response as IDataObject)
							: { data: response as IDataObject };

					returnData.push({
						json: normalizedOutput,
						pairedItem: { item: i },
					});
				} else if (resource === 'auth') {
					const credentials = await getPayloadCredentials(this, i);
					const authCollectionOverride = (
						this.getNodeParameter('authCollection', i, '') as string
					).trim();
					const authCollection = authCollectionOverride || credentials.authCollection || 'users';
					const encodedAuthCollection = encodeURIComponent(authCollection);
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const qs: IDataObject = {};
					applyPayloadOptionsToQuery(qs, options);

					if (operation === 'login') {
						const email = this.getNodeParameter('email', i) as string;
						const password = this.getNodeParameter('password', i) as string;
						const response = (await payloadApiRequest.call(
							this,
							'POST',
							`/${encodedAuthCollection}/login`,
							{ email, password },
							qs,
							{ skipAuth: true },
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'me') {
						const response = (await payloadApiRequest.call(
							this,
							'GET',
							`/${encodedAuthCollection}/me`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'refreshToken') {
						const response = (await payloadApiRequest.call(
							this,
							'POST',
							`/${encodedAuthCollection}/refresh-token`,
							undefined,
							qs,
						)) as IDataObject;

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					} else if (operation === 'logout') {
						const response = (await payloadApiRequest.call(
							this,
							'POST',
							`/${encodedAuthCollection}/logout`,
							undefined,
							qs,
						)) as IDataObject;

						clearJwtCache();

						returnData.push({
							json: response,
							pairedItem: { item: i },
						});
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
