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

import { before, describe, it } from 'node:test';
import assert from 'node:assert';

import { clouddeploy_v1 } from 'googleapis';
import { getExecOutput } from '@actions/exec';
import yaml from 'js-yaml';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
describe('E2E tests', async () => {
  const { ANNOTATIONS, DELIVERY_PIPELINE, DESCRIPTION, LABELS, NAME, PROJECT_ID, REGION } =
    process.env;

  let release: clouddeploy_v1.Schema$Release;
  let toolCommand: string;

  before(async () => {
    toolCommand = 'gcloud';
    if (NAME && DELIVERY_PIPELINE && PROJECT_ID && REGION) {
      // get Service yaml
      const cmd = [
        'deploy',
        'releases',
        'describe',
        NAME,
        '--delivery-pipeline',
        DELIVERY_PIPELINE,
        '--project',
        PROJECT_ID,
        '--format',
        'yaml',
        '--region',
        REGION,
      ];

      const options = { silent: true, ignoreReturnCode: true };
      const commandString = `${toolCommand} ${cmd.join(' ')}`;
      const output = await getExecOutput(toolCommand, cmd, options);
      if (output.exitCode !== 0) {
        const errMsg =
          output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
        throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
      }

      release = yaml.load(output.stdout) as clouddeploy_v1.Schema$Release;
      if (!release) console.error('no release found');
    }
  });

  it('has the correct annotations', async () => {
    if (ANNOTATIONS && release) {
      const expected = JSON.parse(ANNOTATIONS);
      const actual = release?.annotations || {};

      // Filter out only the keys we care about
      const subset = Object.assign({}, ...Object.keys(expected).map((k) => ({ [k]: actual[k] })));

      assert.deepStrictEqual(subset, expected);
    }
  });

  it('has the correct description', async () => {
    if (DESCRIPTION && release) {
      const actual = release?.description;
      assert.deepStrictEqual(actual, DESCRIPTION);
    }
  });

  it('has the correct name', async () => {
    if (NAME && release) {
      const actual = release?.name;
      assert.deepStrictEqual(actual, NAME);
    }
  });

  it('has the correct labels', async () => {
    if (LABELS && release) {
      const expected = JSON.parse(LABELS);
      const actual = release?.labels;
      assert.deepStrictEqual(actual, expected);
    }
  });
});
