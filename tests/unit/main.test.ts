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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import * as utils from '../../src/utils';

import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';
import { errorMessage } from '@google-github-actions/actions-utils';

import { run } from '../../src/main';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  delivery_pipeline: 'delivery-pipeline',
  name: 'release-001',
  region: 'us-central1',
  source: 'src',
  build_artifacts: 'artifacts.json',
  images: '',
  sourceStagingDir: '',
  skaffoldFile: '',
  description: '',
  flags: '',
  annotations: '',
  labels: '',
};

function getInputMock(name: string): string {
  return fakeInputs[name];
}

describe('#run', function () {
  beforeEach(async function () {
    await TestToolCache.start();

    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      getBooleanInput: sinon.stub(core, 'getBooleanInput').returns(false),
      exportVariable: sinon.stub(core, 'exportVariable'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      getLatestGcloudSDKVersion: sinon
        .stub(setupGcloud, 'getLatestGcloudSDKVersion')
        .resolves('1.2.3'),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(true),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      installComponent: sinon.stub(setupGcloud, 'installComponent'),
      getExecOutput: sinon
        .stub(exec, 'getExecOutput')
        .resolves({ exitCode: 0, stderr: '', stdout: '{}' }),
      getDefaultAnnotations: sinon
        .stub(utils, 'getDefaultAnnotations')
        .returns({ DEFAULT_ANNOTATION_KEY: 'default_annotation_value' }),
      getDefaultLabels: sinon
        .stub(utils, 'getDefaultLabels')
        .returns({ DEFAULT_LABEL_KEY: 'default_label_value' }),
    };

    sinon.stub(core, 'setFailed').throwsArg(0); // make setFailed throw exceptions
    sinon.stub(core, 'addPath').callsFake(sinon.fake());
    sinon.stub(core, 'debug').callsFake(sinon.fake());
    sinon.stub(core, 'endGroup').callsFake(sinon.fake());
    sinon.stub(core, 'info').callsFake(sinon.fake());
    sinon.stub(core, 'startGroup').callsFake(sinon.fake());
    sinon.stub(core, 'warning').callsFake(sinon.fake());
  });

  afterEach(async function () {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
    sinon.restore();
    delete process.env.GITHUB_SHA;
    await TestToolCache.stop();
  });

  it('installs the gcloud SDK if it is not already installed', async function () {
    this.stubs.isInstalled.returns(false);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(1);
  });

  it('uses the cached gcloud SDK if it was already installed', async function () {
    this.stubs.isInstalled.returns(true);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(0);
  });

  it('fails if release name is not provided', async function () {
    this.stubs.getInput.withArgs('name').returns('');
    expectError(run, 'No release name set.');
  });

  it('fails if delivery_pipeline is not provided', async function () {
    this.stubs.getInput.withArgs('delivery_pipeline').returns('');
    expectError(run, 'No delivery pipeline set.');
  });

  it('fails if region is not provided', async function () {
    this.stubs.getInput.withArgs('region').returns('');
    expectError(run, 'No region set.');
  });

  it('fails if neither build-artifacts nor images are provided', async function () {
    this.stubs.getInput.withArgs('build_artifacts').returns('');
    this.stubs.getInput.withArgs('images').returns('');
    expectError(run, 'One of `build_artifacts` and `images` inputs must be supplied.');
  });

  it('fails if build-artifacts and images are both provided', async function () {
    this.stubs.getInput.withArgs('build_artifacts').returns('artifacts.json');
    this.stubs.getInput.withArgs('images').returns('image1=image1:tag1');
    expectError(run, 'Both `build_artifacts` and `images` inputs set - please select only one.');
  });

  it('sets build-artifacts if given', async function () {
    this.stubs.getInput.withArgs('build_artifacts').returns('artifacts.json');
    this.stubs.getInput.withArgs('images').returns('');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--build-artifacts', 'artifacts.json']);
  });

  it('sets images if given', async function () {
    this.stubs.getInput.withArgs('images').returns('image1=image1:tag1,image2=image2:tag2');
    this.stubs.getInput.withArgs('build_artifacts').returns('');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--images', 'image1=image1:tag1,image2=image2:tag2']);
  });

  it('sets source if given', async function () {
    this.stubs.getInput.withArgs('source').returns('src');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--source', 'src']);
  });

  it('sets disable-initial-rollout if given', async function () {
    this.stubs.getBooleanInput.withArgs('disable_initial_rollout').returns(true);
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--disable-initial-rollout']);
  });

  it('sets gcs-source-staging-dir if given', async function () {
    this.stubs.getInput.withArgs('gcs_source_staging_dir').returns('source/path');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--gcs-source-staging-dir', 'source/path']);
  });

  it('sets skaffold-file if given', async function () {
    this.stubs.getInput.withArgs('skaffold_file').returns('path/to/skaffold.yaml');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--skaffold-file', 'path/to/skaffold.yaml']);
  });

  it('sets annotations if given', async function () {
    this.stubs.getInput.withArgs('annotations').returns('ANNOTATION_KEY=annotation_value');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members([
      '--annotations',
      'DEFAULT_ANNOTATION_KEY=default_annotation_value,ANNOTATION_KEY=annotation_value',
    ]);
  });

  it('sets labels if given', async function () {
    this.stubs.getInput.withArgs('labels').returns('LABEL_KEY=label_value');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members([
      '--labels',
      'DEFAULT_LABEL_KEY=default_label_value,LABEL_KEY=label_value',
    ]);
  });

  it('sets description if given', async function () {
    this.stubs.getInput.withArgs('description').returns('My description');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--description', 'My description']);
  });

  it('sets flags if given', async function () {
    this.stubs.getInput.withArgs('flags').returns('flag1=value1,flag2=value2');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--flags', 'flag1=value1,flag2=value2']);
  });

  it('uses default components without gcloud_component flag', async function () {
    await run();
    expect(this.stubs.installComponent.callCount).to.eq(0);
  });

  it('throws error with invalid gcloud component flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('wrong_value');
    expectError(run, 'invalid input received for gcloud_component: wrong_value');
  });

  it('installs alpha component with alpha flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('alpha');
    await run();
    expect(this.stubs.installComponent.withArgs('alpha').callCount).to.eq(1);
  });

  it('installs beta component with beta flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('beta');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
});

async function expectError(fn: () => Promise<void>, want: string) {
  try {
    await fn();
    throw new Error(`expected error`);
  } catch (err) {
    const msg = errorMessage(err);
    expect(msg).to.include(want);
  }
}
