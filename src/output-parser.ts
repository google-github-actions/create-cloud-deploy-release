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
 * @returns CreateCloudDeployReleaseOutputs
 */
export function parseCreateReleaseResponse(
  stdout: string | undefined,
): CreateCloudDeployReleaseOutputs {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      throw new Error(`no output from create release command`);
    }

    const outputJSON: clouddeploy_v1.Schema$Release = JSON.parse(stdout);
    const name = Array.isArray(outputJSON) ? outputJSON[0].name : outputJSON.name;

    if (!name) {
      throw new Error(`couldn't parse release name`);
    }

    /**
     * The release name format is defined in the Cloud Deploy API spec:
     * https://cloud.google.com/deploy/docs/api/reference/rest/v1/projects.locations.deliveryPipelines.releases#Release
     * Example:
     * projects/{project}/locations/{location}/deliveryPipelines/{deliveryPipeline}/releases/[a-z][a-z0-9-]{0,62}
     */
    const RELEASE_NAME_NUM_FIELDS = 8;
    const nameSplit = name.split('/');

    if (nameSplit.length != RELEASE_NAME_NUM_FIELDS) {
      throw new Error(`couldn't parse release name, unexpected format: ${name}`);
    }

    const linkPrefix = 'https://console.cloud.google.com/deploy/delivery-pipelines';
    const link = `${linkPrefix}/${nameSplit[3]}/${nameSplit[5]}/releases/${nameSplit[7]}?project=${nameSplit[1]}`;
    const outputs: CreateCloudDeployReleaseOutputs = { name: name, link: link };
    return outputs;
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse create release response: ${msg}, stdout: ${stdout}`);
  }
}
