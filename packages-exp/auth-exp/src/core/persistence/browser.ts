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

import { Persistence, PersistenceType, PersistenceValue } from './';

const _STORAGE_AVAILABLE_KEY = '__sak';

class BrowserPersistence implements Persistence {
  type: PersistenceType = PersistenceType.LOCAL;

  constructor(private readonly storage: Storage) {}

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.storage) {
        return false;
      }
      this.storage.setItem(_STORAGE_AVAILABLE_KEY, '1');
      this.storage.removeItem(_STORAGE_AVAILABLE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  async set(key: string, value: PersistenceValue): Promise<void> {
    this.storage.setItem(key, JSON.stringify(value));
  }

  async get<T extends PersistenceValue>(key: string): Promise<T | null> {
    const json = this.storage.getItem(key);
    return json ? JSON.parse(json) : null;
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}

export const browserLocalPersistence: Persistence = new BrowserPersistence(
  localStorage
);
export const browserSessionPersistence: Persistence = new BrowserPersistence(
  sessionStorage
);
