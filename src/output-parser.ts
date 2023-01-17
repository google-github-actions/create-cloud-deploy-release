/*
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { clouddeploy_v1 } from 'googleapis';
import { CreateCloudDeployReleaseOutputs } from './main';
import { errorMessage, presence } from '@google-github-actions/actions-utils';

/**
 * parseCreateReleaseResponse parses the gcloud command response for create-release
 * into a common object
 *
 * @param stdout
 * @returns DeployCloudRunOutputs
 */
export function parseCreateReleaseResponse(
  stdout: string | undefined,
): CreateCloudDeployReleaseOutputs {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      return {};
    }

    const outputJSON: clouddeploy_v1.Schema$Release = JSON.parse(stdout)[0];
    const name = outputJSON?.name;

    if (!name) {
      return {};
    }

    const nameSplit = name.split('/');
    const linkPrefix = 'https://console.cloud.google.com/deploy/delivery-pipelines';
    const link = `${linkPrefix}/${nameSplit[3]}/${nameSplit[5]}/releases/${nameSplit[7]}?project=${nameSplit[1]}`;
    const outputs: CreateCloudDeployReleaseOutputs = { name: name, link: link };
    return outputs;
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse create release response: ${msg}, stdout: ${stdout}`);
  }
}
