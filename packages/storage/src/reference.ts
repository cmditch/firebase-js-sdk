/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Defines the Firebase StorageReference class.
 */

import { FbsBlob } from './implementation/blob';
import { Location } from './implementation/location';
import { getMappings } from './implementation/metadata';
import { child, parent, lastComponent } from './implementation/path';
import {
  list as requestsList,
  getMetadata as requestsGetMetadata,
  updateMetadata as requestsUpdateMetadata,
  getDownloadUrl as requestsGetDownloadUrl,
  deleteObject as requestsDeleteObject,
  multipartUpload
} from './implementation/requests';
import { ListOptions, UploadResult } from './public-types';
import { StringFormat, dataFromString } from './implementation/string';
import { Metadata } from './metadata';
import { FirebaseStorageImpl } from './service';
import { ListResult } from './list';
import { UploadTask } from './task';
import { invalidRootOperation, noDownloadURL } from './implementation/error';
import { validateNumber } from './implementation/type';
import { newConnection } from './platform/connection';

/**
 * Provides methods to interact with a bucket in the Firebase Storage service.
 * @internal
 * @param _location - An fbs.location, or the URL at
 *     which to base this object, in one of the following forms:
 *         gs://<bucket>/<object-path>
 *         http[s]://firebasestorage.googleapis.com/
 *                     <api-version>/b/<bucket>/o/<object-path>
 *     Any query or fragment strings will be ignored in the http[s]
 *     format. If no value is passed, the storage object will use a URL based on
 *     the project ID of the base firebase.App instance.
 */
export class Reference {
  _location: Location;

  constructor(
    private _service: FirebaseStorageImpl,
    location: string | Location
  ) {
    if (location instanceof Location) {
      this._location = location;
    } else {
      this._location = Location.makeFromUrl(location, _service.host);
    }
  }

  /**
   * Returns the URL for the bucket and path this object references,
   *     in the form gs://<bucket>/<object-path>
   * @override
   */
  toString(): string {
    return 'gs://' + this._location.bucket + '/' + this._location.path;
  }

  protected _newRef(
    service: FirebaseStorageImpl,
    location: Location
  ): Reference {
    return new Reference(service, location);
  }

  /**
   * A reference to the root of this object's bucket.
   */
  get root(): Reference {
    const location = new Location(this._location.bucket, '');
    return this._newRef(this._service, location);
  }

  /**
   * The name of the bucket containing this reference's object.
   */
  get bucket(): string {
    return this._location.bucket;
  }

  /**
   * The full path of this object.
   */
  get fullPath(): string {
    return this._location.path;
  }

  /**
   * The short name of this object, which is the last component of the full path.
   * For example, if fullPath is 'full/path/image.png', name is 'image.png'.
   */
  get name(): string {
    return lastComponent(this._location.path);
  }

  /**
   * The `StorageService` instance this `StorageReference` is associated with.
   */
  get storage(): FirebaseStorageImpl {
    return this._service;
  }

  /**
   * A `StorageReference` pointing to the parent location of this `StorageReference`, or null if
   * this reference is the root.
   */
  get parent(): Reference | null {
    const newPath = parent(this._location.path);
    if (newPath === null) {
      return null;
    }
    const location = new Location(this._location.bucket, newPath);
    return new Reference(this._service, location);
  }

  /**
   * Utility function to throw an error in methods that do not accept a root reference.
   */
  _throwIfRoot(name: string): void {
    if (this._location.path === '') {
      throw invalidRootOperation(name);
    }
  }
}

/**
 * Uploads data to this object's location.
 * The upload is not resumable.
 *
 * @param ref - StorageReference where data should be uploaded.
 * @param data - The data to upload.
 * @param metadata - Metadata for the newly uploaded data.
 * @returns A Promise containing an UploadResult
 */
export function uploadBytes(
  ref: Reference,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: Metadata
): Promise<UploadResult> {
  ref._throwIfRoot('uploadBytes');
  const requestInfo = multipartUpload(
    ref.storage,
    ref._location,
    getMappings(),
    new FbsBlob(data, true),
    metadata
  );
  return ref.storage
    .makeRequestWithTokens(requestInfo, newConnection)
    .then(finalMetadata => {
      return {
        metadata: finalMetadata,
        ref
      };
    });
}

/**
 * Uploads data to this object's location.
 * The upload can be paused and resumed, and exposes progress updates.
 * @public
 * @param ref - StorageReference where data should be uploaded.
 * @param data - The data to upload.
 * @param metadata - Metadata for the newly uploaded data.
 * @returns An UploadTask
 */
export function uploadBytesResumable(
  ref: Reference,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: Metadata
): UploadTask {
  ref._throwIfRoot('uploadBytesResumable');
  return new UploadTask(ref, new FbsBlob(data), metadata);
}

/**
 * Uploads a string to this object's location.
 * The upload is not resumable.
 * @public
 * @param ref - StorageReference where string should be uploaded.
 * @param value - The string to upload.
 * @param format - The format of the string to upload.
 * @param metadata - Metadata for the newly uploaded string.
 * @returns A Promise containing an UploadResult
 */
export function uploadString(
  ref: Reference,
  value: string,
  format: StringFormat = StringFormat.RAW,
  metadata?: Metadata
): Promise<UploadResult> {
  ref._throwIfRoot('uploadString');
  const data = dataFromString(format, value);
  const metadataClone = { ...metadata } as Metadata;
  if (metadataClone['contentType'] == null && data.contentType != null) {
    metadataClone['contentType'] = data.contentType!;
  }
  return uploadBytes(ref, data.data, metadataClone);
}

/**
 * List all items (files) and prefixes (folders) under this storage reference.
 *
 * This is a helper method for calling list() repeatedly until there are
 * no more results. The default pagination size is 1000.
 *
 * Note: The results may not be consistent if objects are changed while this
 * operation is running.
 *
 * Warning: listAll may potentially consume too many resources if there are
 * too many results.
 * @public
 * @param ref - StorageReference to get list from.
 *
 * @returns A Promise that resolves with all the items and prefixes under
 *      the current storage reference. `prefixes` contains references to
 *      sub-directories and `items` contains references to objects in this
 *      folder. `nextPageToken` is never returned.
 */
export function listAll(ref: Reference): Promise<ListResult> {
  const accumulator: ListResult = {
    prefixes: [],
    items: []
  };
  return listAllHelper(ref, accumulator).then(() => accumulator);
}

/**
 * Separated from listAll because async functions can't use "arguments".
 * @param ref
 * @param accumulator
 * @param pageToken
 */
async function listAllHelper(
  ref: Reference,
  accumulator: ListResult,
  pageToken?: string
): Promise<void> {
  const opt: ListOptions = {
    // maxResults is 1000 by default.
    pageToken
  };
  const nextPage = await list(ref, opt);
  accumulator.prefixes.push(...nextPage.prefixes);
  accumulator.items.push(...nextPage.items);
  if (nextPage.nextPageToken != null) {
    await listAllHelper(ref, accumulator, nextPage.nextPageToken);
  }
}

/**
 * List items (files) and prefixes (folders) under this storage reference.
 *
 * List API is only available for Firebase Rules Version 2.
 *
 * GCS is a key-blob store. Firebase Storage imposes the semantic of '/'
 * delimited folder structure.
 * Refer to GCS's List API if you want to learn more.
 *
 * To adhere to Firebase Rules's Semantics, Firebase Storage does not
 * support objects whose paths end with "/" or contain two consecutive
 * "/"s. Firebase Storage List API will filter these unsupported objects.
 * list() may fail if there are too many unsupported objects in the bucket.
 * @public
 *
 * @param ref - StorageReference to get list from.
 * @param options - See ListOptions for details.
 * @returns A Promise that resolves with the items and prefixes.
 *      `prefixes` contains references to sub-folders and `items`
 *      contains references to objects in this folder. `nextPageToken`
 *      can be used to get the rest of the results.
 */
export function list(
  ref: Reference,
  options?: ListOptions | null
): Promise<ListResult> {
  if (options != null) {
    if (typeof options.maxResults === 'number') {
      validateNumber(
        'options.maxResults',
        /* minValue= */ 1,
        /* maxValue= */ 1000,
        options.maxResults
      );
    }
  }
  const op = options || {};
  const requestInfo = requestsList(
    ref.storage,
    ref._location,
    /*delimiter= */ '/',
    op.pageToken,
    op.maxResults
  );
  return ref.storage.makeRequestWithTokens(requestInfo, newConnection);
}

/**
 * A `Promise` that resolves with the metadata for this object. If this
 * object doesn't exist or metadata cannot be retreived, the promise is
 * rejected.
 * @public
 * @param ref - StorageReference to get metadata from.
 */
export function getMetadata(ref: Reference): Promise<Metadata> {
  ref._throwIfRoot('getMetadata');
  const requestInfo = requestsGetMetadata(
    ref.storage,
    ref._location,
    getMappings()
  );
  return ref.storage.makeRequestWithTokens(requestInfo, newConnection);
}

/**
 * Updates the metadata for this object.
 * @public
 * @param ref - StorageReference to update metadata for.
 * @param metadata - The new metadata for the object.
 *     Only values that have been explicitly set will be changed. Explicitly
 *     setting a value to null will remove the metadata.
 * @returns A `Promise` that resolves
 *     with the new metadata for this object.
 *     See `firebaseStorage.Reference.prototype.getMetadata`
 */
export function updateMetadata(
  ref: Reference,
  metadata: Partial<Metadata>
): Promise<Metadata> {
  ref._throwIfRoot('updateMetadata');
  const requestInfo = requestsUpdateMetadata(
    ref.storage,
    ref._location,
    metadata,
    getMappings()
  );
  return ref.storage.makeRequestWithTokens(requestInfo, newConnection);
}

/**
 * Returns the download URL for the given Reference.
 * @public
 * @returns A `Promise` that resolves with the download
 *     URL for this object.
 */
export function getDownloadURL(ref: Reference): Promise<string> {
  ref._throwIfRoot('getDownloadURL');
  const requestInfo = requestsGetDownloadUrl(
    ref.storage,
    ref._location,
    getMappings()
  );
  return ref.storage
    .makeRequestWithTokens(requestInfo, newConnection)
    .then(url => {
      if (url === null) {
        throw noDownloadURL();
      }
      return url;
    });
}

/**
 * Deletes the object at this location.
 * @public
 * @param ref - StorageReference for object to delete.
 * @returns A `Promise` that resolves if the deletion succeeds.
 */
export function deleteObject(ref: Reference): Promise<void> {
  ref._throwIfRoot('deleteObject');
  const requestInfo = requestsDeleteObject(ref.storage, ref._location);
  return ref.storage.makeRequestWithTokens(requestInfo, newConnection);
}

/**
 * Returns reference for object obtained by appending `childPath` to `ref`.
 *
 * @param ref - StorageReference to get child of.
 * @param childPath - Child path from provided ref.
 * @returns A reference to the object obtained by
 * appending childPath, removing any duplicate, beginning, or trailing
 * slashes.
 *
 */
export function _getChild(ref: Reference, childPath: string): Reference {
  const newPath = child(ref._location.path, childPath);
  const location = new Location(ref._location.bucket, newPath);
  return new Reference(ref.storage, location);
}
