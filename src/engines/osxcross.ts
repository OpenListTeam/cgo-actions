// This file provides build for macOS
import { $$, calFlags, TempBinName } from '../utils'
import { registerEngine } from '../runner'
import fs from 'fs'

export async function setupMacOSSDK(basedir: string) {
  const OSX_SDK = 'MacOSX15.5.sdk.tar.xz'
  const OSX_SDK_URL = `https://github.com/joseluisq/macosx-sdks/releases/download/15.5/${OSX_SDK}`
  // Download and extract the SDK
  if (!fs.existsSync(`${basedir}/${OSX_SDK}`)) {
    console.log(`Downloading macOS SDK from ${OSX_SDK_URL}...`)
    const sdkFile = `${basedir}/${OSX_SDK}`
    await $$`curl -fsSL -o ${sdkFile} ${OSX_SDK_URL}`
  }
  return {
    sdk: `${basedir}/${OSX_SDK}`
  }
}

export async function setupOSXCross() {
  const downloadUrl =
    'https://github.com/tpoechtrager/osxcross/archive/refs/heads/master.tar.gz'
  const osxcrossDir = '/opt/osxcross'
  if (!fs.existsSync(osxcrossDir)) {
    await $$`mkdir -p ${osxcrossDir}`
    await $$`curl -fsSL -o /tmp/osxcross.tar.gz ${downloadUrl}`
    await $$`tar -xzf /tmp/osxcross.tar.gz -C ${osxcrossDir} --strip-components=1`
    await $$`rm /tmp/osxcross.tar.gz`

    await setupMacOSSDK(`${osxcrossDir}/tarballs`)
    // Install deps
    await $$`sudo apt update`
    await $$`sudo apt install -y clang-19 cmake git patch python3 libssl-dev lzma-dev libxml2-dev xz-utils bzip2 cpio bzip2 zlib1g-dev llvm-19-dev uuid-dev bash`
    // Remove old clang if it exists
    await $$(
      String.raw`if [ -d /usr/bin/clang ]; then sudo mv /usr/bin/clang /usr/bin/clang.backup; fi`
    )
    await $$(
      String.raw`if [ -d /usr/bin/clang++ ]; then sudo mv /usr/bin/clang++ /usr/bin/clang++.backup; fi`
    )
    await $$(
      String.raw`sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-19 100`
    )
    await $$(
      String.raw`sudo update-alternatives --install /usr/bin/clang++ clang++ /usr/bin/clang++-19 100`
    )
    // Build OSXCross
    await $$`UNATTENDED=1 bash ${osxcrossDir}/build.sh`
  }
  return `${osxcrossDir}/target`
}

const appleTargetMap = {
  'apple-x86_64': 'o64',
  'apple-arm64': 'oa64'
} as Record<string, string>

const archMap = {
  x86_64: 'amd64',
  arm64: 'arm64'
} as Record<string, string>

registerEngine({
  targets: Object.keys(appleTargetMap),
  async prepare(input) {
    console.log(input.output)
  },
  async run(input) {
    const sdk_dir = await setupOSXCross()
    const target = input.target
    const arch = archMap[target.split('-')[1]]
    const osxcrossTarget = appleTargetMap[target]
    await input.$({
      env: {
        CGO_ENABLED: '1',
        GOOS: 'darwin',
        GOARCH: arch,
        CC: `${sdk_dir}/bin/${osxcrossTarget}-clang`,
        CXX: `${sdk_dir}/bin/${osxcrossTarget}-clang++`
      }
    })`go build -o ${TempBinName}.exe ${calFlags(input.flags)} ${input.pkgs}`
  }
})
