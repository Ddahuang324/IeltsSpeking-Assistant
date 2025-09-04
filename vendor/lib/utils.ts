/**
 * Copyright 2024 Google LLC
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

export type GetAudioContextOptions = AudioContextOptions & {
  id?: string;
};

const map: Map<string, AudioContext> = new Map();

export const audioContext: (
  options?: GetAudioContextOptions,
) => Promise<AudioContext> = (() => {
  const didInteract = new Promise((res) => {
    if(typeof window === "undefined")return;
    window.addEventListener("pointerdown", res, { once: true });
    window.addEventListener("keydown", res, { once: true });
  });

  return async (options?: GetAudioContextOptions) => {
    try {
      const a = new Audio();
      a.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      await a.play();
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id);
        if (ctx) {
          return ctx;
        }
      }
      const ctx = new AudioContext(options);
      if (options?.id) {
        map.set(options.id, ctx);
      }
      return ctx;
    } catch (e) {
      await didInteract;
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id);
        if (ctx) {
          return ctx;
        }
      }
      const ctx = new AudioContext(options);
      if (options?.id) {
        map.set(options.id, ctx);
      }
      return ctx;
    }
  };
})();

export const blobToJSON = (blob: Blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const json = JSON.parse(reader.result as string);
        resolve(json);
      } else {
        reject("oops");
      }
    };
    reader.readAsText(blob);
  });

export function base64ToArrayBuffer(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function base64sToArrayBuffer(base64s: string[]) {
  var binaryString = base64s.map(atob).join('');
  var bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function pcmBufferToBlob(buffer: ArrayBuffer, sampleRate = 16000, bytesPerSample = 16): Blob {
  const headerLength = 44;
  const numberOfChannels = 1;
  const byteLength = buffer.byteLength;
  const header = new Uint8Array(headerLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1380533830, false); // RIFF identifier 'RIFF'
  view.setUint32(4, 36 + byteLength, true); // file length minus RIFF identifier length and file description length
  view.setUint32(8, 1463899717, false); // RIFF type 'WAVE'
  view.setUint32(12, 1718449184, false); // format chunk identifier 'fmt '
  view.setUint32(16, 16, true); // format chunk length
  view.setUint16(20, 1, true); // sample format (raw)
  view.setUint16(22, numberOfChannels, true); // channel count
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 4, true); // byte rate (sample rate * block align)
  view.setUint16(32, numberOfChannels * 2, true); // block align (channel count * bytes per sample)
  view.setUint16(34, bytesPerSample, true); // bits per sample
  view.setUint32(36, 1684108385, false); // data chunk identifier 'data'
  view.setUint32(40, byteLength, true); // data chunk length

  // using data.buffer, so no need to setUint16 to view.
  return new Blob([view, buffer], { type: "audio/wav" });
}