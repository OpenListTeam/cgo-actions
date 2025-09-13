import { $$, calFlags, TempBinName } from '../utils'
import { compareVersions } from 'compare-versions'
import * as core from '@actions/core'
import { registerEngine } from '../runner'
import { $ } from 'execa'
import { Input } from '../types'

// Store available go version and its download links
const oldWorldGoVersionDict: Record<string, string> = {
  '1.25.0': '20250821/go1.25.0.linux-amd64.tar.gz',
  '1.24.6': '20250821/go1.24.6.linux-amd64.tar.gz',
  '1.24.3': '20250722/go1.24.3.linux-amd64.tar.gz',
  '1.24.0': '20250722/go1.24.0.linux-amd64.tar.gz'
}

const cwd = process.cwd()

async function getGoVersion() {
  const goVersion = await $`go version`
  // go version go1.24.1 darwin/arm64
  const match = goVersion.stdout.match(/go(\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error('Failed to get go version')
  }
  return match[1]
}

async function setupABI1_0Go(input: Input) {
  // Get system go version
  const currentGoVersion = await getGoVersion()
  // Choose a specific version of go
  const oldWorldGoVersion = Object.keys(oldWorldGoVersionDict).find(version =>
    compareVersions(version, currentGoVersion)
  )
  let oldWorldGoUrl = ''
  if (!oldWorldGoVersion) {
    const error_str = `Current go version ${currentGoVersion} is not supported for linux-loong64-abi1.0. Automatically choosed the latest version listed in ${Object.keys(oldWorldGoVersionDict)}`
    core.warning(error_str)
    // Choose the latest version
    const _version_list = Object.keys(oldWorldGoVersionDict).sort(
      compareVersions
    )
    oldWorldGoUrl =
      oldWorldGoVersionDict[_version_list[_version_list.length - 1]]
  } else {
    oldWorldGoUrl = oldWorldGoVersionDict[oldWorldGoVersion]
  }

  core.info(`Using go version ${oldWorldGoVersion}`)

  // Get major and minor version
  await $$`curl -H ${String.raw`Authorization: Bearer ${input.github_token}`} -fsSL --retry 3 https://github.com/loong64/loong64-abi1.0-toolchains/releases/download/${oldWorldGoUrl} -o go-loong64-abi1.0.tar.gz`
  await $$`rm -rf go-loong64-abi1.0`
  await $$`mkdir go-loong64-abi1.0`
  await $$`tar -xzf go-loong64-abi1.0.tar.gz -C go-loong64-abi1.0 --strip-components=1`
  await $$`rm go-loong64-abi1.0.tar.gz`
  return `${cwd}/go-loong64-abi1.0/bin/go`
}

async function setupABI1_0GCC(input: Input) {
  await $$`curl -H ${String.raw`Authorization: Bearer ${input.github_token}`} -fsSL --retry 3 https://github.com/loong64/loong64-abi1.0-toolchains/releases/download/20250722/loongson-gnu-toolchain-8.3-x86_64-loongarch64-linux-gnu-rc1.6.tar.xz -o gcc8-loong64-abi1.0.tar.xz`
  await $$`rm -rf gcc8-loong64-abi1.0`
  await $$`mkdir gcc8-loong64-abi1.0`
  await $$`tar -Jxf gcc8-loong64-abi1.0.tar.xz -C gcc8-loong64-abi1.0 --strip-components=1`
  await $$`rm gcc8-loong64-abi1.0.tar.xz`
  return `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-`
}

async function setupABI2_0GCC(input: Input) {
  await $$`curl -fsSL --retry 3 -o gcc12-loong64-abi2.0.tar.xz -H ${String.raw`Authorization: Bearer ${input.github_token}`} https://github.com/loong64/cross-tools/releases/download/20250507/x86_64-cross-tools-loongarch64-unknown-linux-gnu-legacy.tar.xz`
  await $$`rm -rf gcc12-loong64-abi2.0`
  await $$`mkdir gcc12-loong64-abi2.0`
  await $$`tar -Jxf gcc12-loong64-abi2.0.tar.xz -C gcc12-loong64-abi2.0 --strip-components=1`
  await $$`rm gcc12-loong64-abi2.0.tar.xz`
  return `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-`
}

registerEngine({
  targets: ['linux-loong64', 'linux-loong64-abi1.0'],
  async prepare(input) {
    await setupABI1_0GCC(input)
    await setupABI2_0GCC(input)
    await setupABI1_0Go(input)
  },
  async run(input) {
    const target = input.target
    const os = target.split('-')[0]
    const arch = target.split('-')[1]
    const abi = target.split('-')[2] ?? 'abi2.0'
    if (abi === 'abi1.0') {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-gcc`,
          CXX: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-g++`
        }
      })`${cwd}/go-loong64-abi1.0/bin/go build -a -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    } else {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-gcc`,
          CXX: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-g++`
        }
      })`go build -a -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    }
  }
})
