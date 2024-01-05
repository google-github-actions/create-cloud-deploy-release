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

import { afterEach, beforeEach, describe, mock, it } from 'node:test';
import assert from 'node:assert';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';

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

describe('#run', async () => {
  beforeEach(async () => {
    await TestToolCache.start();
  });

  afterEach(async () => {
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_SERVER_URL;
    await TestToolCache.stop();
  });

  it('installs the gcloud SDK if it is not already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return false;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 1);
  });

  it('uses the cached gcloud SDK if it was already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return true;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 0);
  });

  it('fails if release name is not provided', async (t) => {
    defaultMocks(t.mock, {
      name: '',
    });
    assert.rejects(run, 'No release name set.');
  });

  it('fails if delivery_pipeline is not provided', async (t) => {
    defaultMocks(t.mock, {
      delivery_pipeline: '',
    });
    assert.rejects(run, 'No delivery pipeline set.');
  });

  it('fails if neither build-artifacts nor images are provided', async (t) => {
    defaultMocks(t.mock, {
      build_artifacts: '',
      images: '',
    });
    assert.rejects(run, 'One of `build_artifacts` and `images` inputs must be supplied.');
  });

  it('fails if build-artifacts and images are both provided', async (t) => {
    defaultMocks(t.mock, {
      build_artifacts: 'artifacts.json',
      images: 'image1=image1:tag1',
    });
    assert.rejects(run, 'Both `build_artifacts` and `images` inputs set - please select only one.');
  });

  it('sets project if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      project_id: 'my-test-project',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--project',
      'my-test-project',
    ]);
  });

  it('sets region if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      region: 'europe-west1',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--region',
      'europe-west1',
    ]);
  });

  it('sets build-artifacts if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      build_artifacts: 'artifacts.json',
      images: '',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--build-artifacts',
      'artifacts.json',
    ]);
  });

  it('sets images if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      build_artifacts: '',
      images: 'image1=image1:tag1,image2=image2:tag2',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--images',
      'image1=image1:tag1,image2=image2:tag2',
    ]);
  });

  it('sets source if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      source: './src',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), ['--source', './src']);
  });

  it('sets disable-initial-rollout if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      disable_initial_rollout: 'true',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--disable-initial-rollout',
    ]);
  });

  it('sets gcs-source-staging-dir if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcs_source_staging_dir: 'source/path',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--gcs-source-staging-dir',
      'source/path',
    ]);
  });

  it('sets skaffold-file if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      skaffold_file: 'path/to/skaffold.yaml',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--skaffold-file',
      'path/to/skaffold.yaml',
    ]);
  });

  it('sets default annotations', async (t) => {
    const mocks = defaultMocks(t.mock, {
      annotations: '',
    });

    process.env.GITHUB_REPOSITORY = 'test-org/test-repo';
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--annotations',
      'commit=https://github.com/test-org/test-repo/commit/abcdef123456,git-sha=abcdef123456',
    ]);
  });

  it('sets default and additional annotations if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      annotations: 'annotation_key=annotation_value',
    });

    process.env.GITHUB_REPOSITORY = 'test-org/test-repo';
    process.env.GITHUB_SERVER_URL = 'https://github.com';
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--annotations',
      'commit=https://github.com/test-org/test-repo/commit/abcdef123456,git-sha=abcdef123456,annotation_key=annotation_value',
    ]);
  });

  it('sets default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      labels: '',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--labels',
      'managed-by=github-actions',
    ]);
  });

  it('sets default and additional labels if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      labels: 'label_key=label_value',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--labels',
      'managed-by=github-actions,label_key=label_value',
    ]);
  });

  it('sets description if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      description: 'My description',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--description',
      'My description',
    ]);
  });

  it('sets deploy parameters if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      deploy_parameters: 'param-key=param-value',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--deploy-parameters',
      'param-key=param-value',
    ]);
  });

  it('sets flags if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      flags: '--flag1=value1 --flag2=value2',
    });

    await run();

    expectSubArray(mocks.getExecOutput.mock.calls?.at(0)?.arguments?.at(1), [
      '--flag1',
      'value1',
      '--flag2',
      'value2',
    ]);
  });

  it('uses default components without gcloud_component flag', async (t) => {
    const mocks = defaultMocks(t.mock);
    await run();
    assert.deepStrictEqual(mocks.installComponent.mock.callCount(), 0);
  });

  it('throws error with invalid gcloud component flag', async (t) => {
    defaultMocks(t.mock, {
      gcloud_component: 'wrong_value',
    });
    assert.rejects(run, 'invalid input received for gcloud_component: wrong_value');
  });

  it('installs alpha component with alpha flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'alpha',
    });

    await run();

    expectSubArray(mocks.installComponent.mock.calls?.at(0)?.arguments, ['alpha']);
  });

  it('installs beta component with beta flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'beta',
    });

    await run();

    expectSubArray(mocks.installComponent.mock.calls?.at(0)?.arguments, ['beta']);
  });
});

const expectSubArray = (m: string[], exp: string[]) => {
  const window = exp.length;
  for (let i = 0; i < m.length; i++) {
    const x = m.slice(i, i + window);

    let matches = true;
    for (let j = 0; j < exp.length; j++) {
      if (x[j] !== exp[j]) {
        matches = false;
      }
    }
    if (matches) {
      return true;
    }
  }

  throw new assert.AssertionError({
    message: 'mismatch',
    actual: m,
    expected: exp,
    operator: 'subArray',
  });
};
