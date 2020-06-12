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

import * as externs from '@firebase/auth-types-exp';

import * as api from '../../api/authentication/email_and_password';
import { Operation } from '../../model/action_code_info';
import { Auth } from '../../model/auth';
import { ActionCodeURL } from '../action_code_url';
import { EmailAuthProvider } from '../providers/email';
import { _getCurrentUrl } from '../util/location';
import { setActionCodeSettingsOnRequest } from './action_code_settings';
import { signInWithCredential } from './credential';

export async function sendSignInLinkToEmail(
  auth: externs.Auth,
  email: string,
  actionCodeSettings?: externs.ActionCodeSettings
): Promise<void> {
  const request: api.EmailSignInRequest = {
    requestType: Operation.EMAIL_SIGNIN,
    email
  };
  if (actionCodeSettings) {
    setActionCodeSettingsOnRequest(request, actionCodeSettings);
  }

  await api.sendSignInLinkToEmail(auth as Auth, request);
}

export function isSignInWithEmailLink(
  auth: externs.Auth,
  emailLink: string
): boolean {
  const actionCodeUrl = ActionCodeURL._fromLink(auth as Auth, emailLink);
  return actionCodeUrl?.operation === Operation.EMAIL_SIGNIN;
}

export async function signInWithEmailLink(
  auth: externs.Auth,
  email: string,
  emailLink?: string
): Promise<externs.UserCredential> {
  return signInWithCredential(
    auth,
    EmailAuthProvider.credentialWithLink(
      auth as Auth,
      email,
      emailLink || _getCurrentUrl()
    )
  );
}
