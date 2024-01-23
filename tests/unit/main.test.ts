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

import { test, mock } from 'node:test';
import assert from 'node:assert';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { assertMembers } from '@google-github-actions/actions-utils';

import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';

import * as outputParser from '../../src/output-parser';
import { run } from '../../src/main';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs = {
  delivery_pipeline: 'delivery-pipeline',
  name: 'release-001',
  project_id: '',
  region: 'us-central1',
  source: 'src',
  build_artifacts: 'artifacts.json',
  images: '',
  sourceStagingDir: '',
  skaffoldFile: '',
  description: '',
  deploy_parameters: '',
  flags: '',
  annotations: '',
  labels: '',
};

const defaultMocks = (
  m: typeof mock,
  overrideInputs?: Record<string, string>,
): Record<string, any> => {
  const inputs = Object.assign({}, fakeInputs, overrideInputs);
  return {
    startGroup: m.method(core, 'startGroup', () => {}),
    endGroup: m.method(core, 'endGroup', () => {}),
    group: m.method(core, 'group', () => {}),
    logDebug: m.method(core, 'debug', () => {}),
    logError: m.method(core, 'error', () => {}),
    logInfo: m.method(core, 'info', () => {}),
    logNotice: m.method(core, 'notice', () => {}),
    logWarning: m.method(core, 'warning', () => {}),
    exportVariable: m.method(core, 'exportVariable', () => {}),
    setSecret: m.method(core, 'setSecret', () => {}),
    addPath: m.method(core, 'addPath', () => {}),
    setOutput: m.method(core, 'setOutput', () => {}),
    setFailed: m.method(core, 'setFailed', (msg: string) => {
      throw new Error(msg);
    }),
    getBooleanInput: m.method(core, 'getBooleanInput', (name: string) => {
      return !!inputs[name];
    }),
    getMultilineInput: m.method(core, 'getMultilineInput', (name: string) => {
      return inputs[name];
    }),
    getInput: m.method(core, 'getInput', (name: string) => {
      return inputs[name];
    }),

    authenticateGcloudSDK: m.method(setupGcloud, 'authenticateGcloudSDK', () => {}),
    isInstalled: m.method(setupGcloud, 'isInstalled', () => {
      return true;
    }),
    installGcloudSDK: m.method(setupGcloud, 'installGcloudSDK', async () => {
      return '1.2.3';
    }),
    installComponent: m.method(setupGcloud, 'installComponent', () => {}),
    getLatestGcloudSDKVersion: m.method(setupGcloud, 'getLatestGcloudSDKVersion', () => {
      return '1.2.3';
    }),

    getExecOutput: m.method(exec, 'getExecOutput', async () => {
      return {
        exitCode: 0,
        stderr: '',
        stdout: '{}',
      };
    }),

    parseCreateResponse: m.method(outputParser, 'parseCreateReleaseResponse', async () => {
      return {
        exitCode: 0,
        stderr: '',
        name: 'a',
        link: 'b',
      };
    }),
  };
};

test('#run', { concurrency: true }, async (suite) => {
  suite.beforeEach(async () => {
    await TestToolCache.start();
  });

  suite.afterEach(async () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_SERVER_URL;
    await TestToolCache.stop();
  });

  await suite.test('installs the gcloud SDK if it is not already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return false;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 1);
  });

  await suite.test('uses the cached gcloud SDK if it was already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return true;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 0);
  });

  await suite.test('fails if release name is not provided', async (t) => {
    defaultMocks(t.mock, {
      name: '',
    });
    await assert.rejects(run, 'No release name set.');
  });

  await suite.test('fails if delivery_pipeline is not provided', async (t) => {
    defaultMocks(t.mock, {
      delivery_pipeline: '',
    });
    await assert.rejects(run, 'No delivery pipeline set.');
  });

  await suite.test('fails if neither build-artifacts nor images are provided', async (t) => {
    defaultMocks(t.mock, {
      build_artifacts: '',
      images: '',
    });
    await assert.rejects(run, 'One of `build_artifacts` and `images` inputs must be supplied.');
  });

  await suite.test('fails if build-artifacts and images are both provided', async (t) => {
    defaultMocks(t.mock, {
      build_artifacts: 'artifacts.json',
      images: 'image1=image1:tag1',
    });
    await assert.rejects(
      run,
      'Both `build_artifacts` and `images` inputs set - please select only one.',
    );
  });

  await suite.test('sets project if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      project_id: 'my-test-project',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--project',
      'my-test-project',
    ]);
  });

  await suite.test('sets region if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      region: 'europe-west1',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--region',
      'europe-west1',
    ]);
  });

  await suite.test('sets build-artifacts if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      build_artifacts: 'artifacts.json',
      images: '',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--build-artifacts',
      'artifacts.json',
    ]);
  });

  await suite.test('sets images if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      build_artifacts: '',
      images: 'image1=image1:tag1,image2=image2:tag2',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--images',
      'image1=image1:tag1,image2=image2:tag2',
    ]);
  });

  await suite.test('sets source if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      source: './src',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), ['--source', './src']);
  });

  await suite.test('sets disable-initial-rollout if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      disable_initial_rollout: 'true',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--disable-initial-rollout',
    ]);
  });

  await suite.test('sets gcs-source-staging-dir if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcs_source_staging_dir: 'source/path',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--gcs-source-staging-dir',
      'source/path',
    ]);
  });

  await suite.test('sets skaffold-file if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      skaffold_file: 'path/to/skaffold.yaml',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--skaffold-file',
      'path/to/skaffold.yaml',
    ]);
  });

  await suite.test('sets default annotations', async (t) => {
    const mocks = defaultMocks(t.mock, {
      annotations: '',
    });

    process.env.GITHUB_REPOSITORY = 'test-org/test-repo';
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--annotations',
      'commit=https://github.com/test-org/test-repo/commit/abcdef123456,git-sha=abcdef123456',
    ]);
  });

  await suite.test('sets default and additional annotations if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      annotations: 'annotation_key=annotation_value',
    });

    process.env.GITHUB_REPOSITORY = 'test-org/test-repo';
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--annotations',
      'commit=https://github.com/test-org/test-repo/commit/abcdef123456,git-sha=abcdef123456,annotation_key=annotation_value',
    ]);
  });

  await suite.test('sets default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      labels: '',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--labels',
      'managed-by=github-actions',
    ]);
  });

  await suite.test('sets default and additional labels if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      labels: 'label_key=label_value',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--labels',
      'managed-by=github-actions,label_key=label_value',
    ]);
  });

  await suite.test('sets description if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      description: 'My description',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--description',
      'My description',
    ]);
  });

  await suite.test('sets deploy parameters if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      deploy_parameters: 'param-key=param-value',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--deploy-parameters',
      'param-key=param-value',
    ]);
  });

  await suite.test('sets flags if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      flags: '--flag1=value1 --flag2=value2',
    });

    await run();

    assertMembers(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--flag1',
      'value1',
      '--flag2',
      'value2',
    ]);
  });

  await suite.test('uses default components without gcloud_component flag', async (t) => {
    const mocks = defaultMocks(t.mock);
    await run();
    assert.deepStrictEqual(mocks.installComponent.mock.callCount(), 0);
  });

  await suite.test('throws error with invalid gcloud component flag', async (t) => {
    defaultMocks(t.mock, {
      gcloud_component: 'wrong_value',
    });
    await assert.rejects(run, 'invalid input received for gcloud_component: wrong_value');
  });

  await suite.test('installs alpha component with alpha flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'alpha',
    });

    await run();

    assertMembers(mocks.installComponent.mock.calls?.at(0)?.arguments, ['alpha']);
  });

  await suite.test('installs beta component with beta flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'beta',
    });

    await run();

    assertMembers(mocks.installComponent.mock.calls?.at(0)?.arguments, ['beta']);
  });
});
