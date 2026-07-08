/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _cms_authz from "../_cms/authz.js";
import type * as _cms_collections from "../_cms/collections.js";
import type * as _cms_pageContent from "../_cms/pageContent.js";
import type * as _cms_projects from "../_cms/projects.js";
import type * as _cms_publish from "../_cms/publish.js";
import type * as _cms_shared from "../_cms/shared.js";
import type * as _cms_storage from "../_cms/storage.js";
import type * as auth from "../auth.js";
import type * as cms from "../cms.js";
import type * as http from "../http.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_cms/authz": typeof _cms_authz;
  "_cms/collections": typeof _cms_collections;
  "_cms/pageContent": typeof _cms_pageContent;
  "_cms/projects": typeof _cms_projects;
  "_cms/publish": typeof _cms_publish;
  "_cms/shared": typeof _cms_shared;
  "_cms/storage": typeof _cms_storage;
  auth: typeof auth;
  cms: typeof cms;
  http: typeof http;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
