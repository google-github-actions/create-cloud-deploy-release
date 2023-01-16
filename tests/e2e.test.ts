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

import { getExecOutput } from '@actions/exec';
import { clouddeploy_v1 } from 'googleapis';
import yaml from 'js-yaml';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
describe('E2E tests', function () {
  const { ANNOTATIONS, DELIVERY_PIPELINE, DESCRIPTION, LABELS, NAME, PROJECT_ID, REGION } =
    process.env;

  let release: clouddeploy_v1.Schema$Release;
  let toolCommand: string;

  before(async function () {
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

  it('has the correct annotations', function () {
    if (ANNOTATIONS && release) {
      const expected = JSON.parse(ANNOTATIONS);
      const actual = release?.annotations;
      expect(actual).to.deep.include(expected);
    }
  });

  it('has the correct description', function () {
    if (DESCRIPTION && release) {
      const actual = release?.description;
      expect(actual).to.deep.eq(DESCRIPTION);
    }
  });

  it('has the correct name', function () {
    if (NAME && release) {
      const actual = release?.name;
      expect(actual).to.deep.eq(NAME);
    }
  });

  it('has the correct labels', function () {
    if (LABELS && release) {
      const expected = JSON.parse(LABELS);
      const actual = release?.labels;
      expect(actual).to.deep.eq(expected);
    }
  });
});
