/**
 * @license
 * Copyright 2020 Google LLC
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
import { Connection } from '../implementation/connection';
import {
  newConnection as nodeNewConnection,
  injectTestConnection as nodeInjectTestConnection
} from './node/connection';

export function newConnection(): Connection {
  // This file is only used under ts-node.
  return nodeNewConnection();
}

export function injectTestConnection(factory: (() => Connection) | null): void {
  // This file is only used under ts-node.
  nodeInjectTestConnection(factory);
}
