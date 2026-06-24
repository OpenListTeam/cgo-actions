import { $$, calFlags, getGoBuildTagsArgs, TempBinName } from '../utils'
import { compareVersions } from 'compare-versions'
import * as core from '@actions/core'
import { registerEngine } from '../runner'
import { $ } from 'execa'
import { Input } from '../types'

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
  core.info(`Local go version is ${currentGoVersion}`)

  // Fetch available versions
  core.info('Fetching available Go versions from loong64-abi1-0/golang...')
  const { stdout: releasesJson } =
    await $`curl -H ${String.raw`Authorization: Bearer ${input.github_token}`} -fsSL https://api.github.com/repos/loong64-abi1-0/golang/releases`

  interface Asset {
    browser_download_url: string
  }
  interface Release {
    tag_name: string
    assets: Asset[]
  }
  const releases = JSON.parse(releasesJson) as Release[]

  const oldWorldGoVersionDict = {} as Record<string, string>
  for (const release of releases) {
    // tag_name example: "go1.26.0" -> "1.26.0"
    const version = release.tag_name.replace(/^go/, '')
    // We need the linux-amd64 toolchain to run on the Action runner
    const asset = release.assets.find(a =>
      a.browser_download_url.endsWith('linux-amd64.tar.gz')
    )
    if (asset) {
      oldWorldGoVersionDict[version] = asset.browser_download_url
    }
  }

  let oldWorldGoVersion = currentGoVersion
  let oldWorldGoUrl = ''
  if (oldWorldGoVersion in oldWorldGoVersionDict) {
    oldWorldGoUrl = oldWorldGoVersionDict[currentGoVersion]
  } else {
    // Choose the latest version
    const _version_list = Object.keys(oldWorldGoVersionDict).sort(
      compareVersions
    )
    const latestVersion = _version_list[_version_list.length - 1]
    const error_str = `Current go version ${currentGoVersion} is not supported for linux-loong64-abi1.0. Automatically choosed the latest version listed in releases: ${latestVersion}`
    core.warning(error_str)

    oldWorldGoVersion = latestVersion
    oldWorldGoUrl = oldWorldGoVersionDict[oldWorldGoVersion]
  }
  core.info(`Using go version ${oldWorldGoVersion} for LoongArch64 ABI1.0`)

  // Get major and minor version
  await $$`curl -H ${String.raw`Authorization: Bearer ${input.github_token}`} -fsSL --retry 3 ${oldWorldGoUrl} -o go-loong64-abi1.0.tar.gz`
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
    const tagsArgs = getGoBuildTagsArgs(input.tags)
    if (abi === 'abi1.0') {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-gcc`,
          CXX: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-g++`
        }
      })`${cwd}/go-loong64-abi1.0/bin/go build ${tagsArgs} -a -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    } else {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-gcc`,
          CXX: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-g++`
        }
      })`go build ${tagsArgs} -a -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    }
  }
})
