/*
 * Copyright 2022 Google LLC
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

import { context } from '@actions/github';
import { KVPair } from '@google-github-actions/actions-utils';

type GithubContext = typeof context;

// Generate default annotations as list of key-value pair
export function getDefaultAnnotations({ repo, serverUrl, sha }: GithubContext): KVPair {
  const annotations: KVPair = {};
  annotations['commit'] = `${serverUrl}/${repo.owner}/${repo.repo}/commit/${sha}`;
  annotations['git-sha'] = `${sha}`;

  return annotations;
}

// Generate default labels as list of key-value pair
export function getDefaultLabels(): KVPair {
  const rawValues: Record<string, string | undefined> = {
    'managed-by': 'github-actions',
  };

  const labels: KVPair = {};
  for (const key in rawValues) {
    const value = rawValues[key];
    if (value) {
      // Labels can only be lowercase
      labels[key] = value.toLowerCase();
    }
  }

  return labels;
}
