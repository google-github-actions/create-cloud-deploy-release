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

import path from 'path';

import {
  addPath,
  getInput,
  getBooleanInput,
  info as logInfo,
  setFailed,
  setOutput,
  warning as logWarning,
} from '@actions/core';
import { getExecOutput } from '@actions/exec';
import * as toolCache from '@actions/tool-cache';
import {
  errorMessage,
  isPinnedToHead,
  joinKVString,
  parseFlags,
  parseKVString,
  pinnedToHeadWarning,
  presence,
  stubEnv,
} from '@google-github-actions/actions-utils';
import {
  authenticateGcloudSDK,
  getLatestGcloudSDKVersion,
  getToolCommand,
  installComponent as installGcloudComponent,
  installGcloudSDK,
  isInstalled as isGcloudInstalled,
} from '@google-github-actions/setup-cloud-sdk';
import { getDefaultAnnotations, getDefaultLabels } from './utils';
import { parseCreateReleaseResponse } from './output-parser';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

/**
 * CreateCloudDeployReleaseOutputs are the common GitHub action outputs created by this action
 */
export interface CreateCloudDeployReleaseOutputs {
  name?: string | null | undefined; // Match clouddeploy_v1.Schema$Release.name
  link?: string | null | undefined; // Link to console based on the above
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  const restoreEnv = stubEnv({
    CLOUDSDK_METRICS_ENVIRONMENT: 'github-actions-create-cloud-deploy-release',
    CLOUDSDK_METRICS_ENVIRONMENT_VERSION: appVersion,
  });

  // Warn if pinned to HEAD
  if (isPinnedToHead()) {
    logWarning(pinnedToHeadWarning('v0'));
  }
  try {
    // Core inputs (required)
    const name = getInput('name');
    const deliveryPipeline = getInput('delivery_pipeline');
    const source = getInput('source');
    const buildArtifacts = getInput('build_artifacts');
    const images = parseKVString(getInput('images'));

    // Common inputs
    const projectId = getInput('project_id');
    const region = getInput('region');
    const disableInitialRollout = getBooleanInput('disable_initial_rollout');
    const sourceStagingDir = getInput('gcs_source_staging_dir');
    const skaffoldFile = getInput('skaffold_file');
    const annotations = parseKVString(getInput('annotations'));
    const labels = parseKVString(getInput('labels'));
    const description = getInput('description');
    const deployParameters = parseKVString(getInput('deploy_parameters'));
    const flags = getInput('flags');
    const gcloudComponent = presence(getInput('gcloud_component'));
    const gcloudVersion = getInput('gcloud_version');

    // Throw errors if inputs aren't valid
    if (!name) {
      throw new Error('No release name set.');
    }
    if (!deliveryPipeline) {
      throw new Error('No delivery pipeline set.');
    }
    if (!buildArtifacts && !Object.keys(images)?.length) {
      throw new Error('One of `build_artifacts` and `images` inputs must be supplied.');
    }
    if (buildArtifacts && Object.keys(images)?.length) {
      throw new Error('Both `build_artifacts` and `images` inputs set - please select only one.');
    }

    // Validate gcloud component input
    if (gcloudComponent && gcloudComponent !== 'alpha' && gcloudComponent !== 'beta') {
      throw new Error(`invalid input received for gcloud_component: ${gcloudComponent}`);
    }

    // Build base command from required inputs
    let cmd = ['deploy', 'releases', 'create', name, '--delivery-pipeline', deliveryPipeline];

    if (projectId) {
      cmd.push('--project', projectId);
    }
    if (region) {
      cmd.push('--region', region);
    } else {
      logWarning(
        'No region set, using gcloud default ("deploy/region"). ' +
          'If this fails, specify a region in action.yml.',
      );
    }

    if (buildArtifacts) {
      cmd.push('--build-artifacts', buildArtifacts);
    }
    if (images && Object.keys(images).length > 0) {
      cmd.push('--images', joinKVString(images));
    }
    if (source) {
      cmd.push('--source', source);
    }
    if (disableInitialRollout) {
      cmd.push('--disable-initial-rollout');
    }
    if (sourceStagingDir) {
      cmd.push('--gcs-source-staging-dir', sourceStagingDir);
    }
    if (skaffoldFile) {
      cmd.push('--skaffold-file', skaffoldFile);
    }
    if (deployParameters && Object.keys(deployParameters).length > 0) {
      cmd.push('--deploy-parameters', joinKVString(deployParameters));
    }

    const allAnnotations = Object.assign({}, getDefaultAnnotations(), annotations);
    cmd.push('--annotations', joinKVString(allAnnotations));

    const allLabels = Object.assign({}, getDefaultLabels(), labels);
    cmd.push('--labels', joinKVString(allLabels));

    if (description) {
      cmd.push('--description', description);
    }
    if (flags) {
      const flagList = parseFlags(flags);
      if (flagList) {
        cmd = cmd.concat(flagList);
      }
    }

    // Set output format to json for easy parsing
    cmd.push('--format', 'json');

    // Install gcloud if not already installed.
    const gcloudVersionRequired = gcloudVersion ? gcloudVersion : await getLatestGcloudSDKVersion();

    if (!isGcloudInstalled(gcloudVersionRequired)) {
      await installGcloudSDK(gcloudVersionRequired);
    } else {
      const toolPath = toolCache.find('gcloud', gcloudVersionRequired);
      addPath(path.join(toolPath, 'bin'));
    }

    // Install gcloud component if needed and prepend the command
    if (gcloudComponent) {
      await installGcloudComponent(gcloudComponent);
      cmd.unshift(gcloudComponent);
    }

    // Authenticate - this comes from google-github-actions/auth.
    const credFile = process.env.GOOGLE_GHA_CREDS_PATH;
    if (credFile) {
      await authenticateGcloudSDK(credFile);
      logInfo('Successfully authenticated');
    } else {
      logWarning('No authentication found, authenticate with `google-github-actions/auth`.');
    }

    const toolCommand = getToolCommand();
    const options = { silent: true, ignoreReturnCode: true };
    const commandString = `${toolCommand} ${cmd.join(' ')}`;
    logInfo(`Running: ${commandString}`);

    // Run gcloud cmd
    const output = await getExecOutput(toolCommand, cmd, options);
    if (output.exitCode !== 0) {
      const errMsg = output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
      throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
    }

    const outputs: CreateCloudDeployReleaseOutputs = parseCreateReleaseResponse(output.stdout);
    setOutput('name', outputs.name);
    setOutput('link', outputs.link);
  } catch (err) {
    const msg = errorMessage(err);
    setFailed(`create-cloud-deploy-release failed with: ${msg}`);
  } finally {
    restoreEnv();
  }
}

if (require.main === module) {
  run();
}
