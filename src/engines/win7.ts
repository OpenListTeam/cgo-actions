import { $$, calFlags, TempBinName } from '../utils'
import { registerEngine } from '../runner'
import fs from 'fs'
import { $ } from 'execa'
import { Input } from '../types'

async function setupZcx(target: string) {
  const zcc = `#!/bin/sh
zig cc -target ${target} $@
`

  const zcxx = `#!/bin/sh
zig c++ -target ${target} $@
`
  if (!fs.existsSync('/usr/local/bin')) {
    fs.mkdirSync('/usr/local/bin', { recursive: true })
  }
  fs.writeFileSync('/usr/local/bin/zcc', zcc)
  fs.writeFileSync('/usr/local/bin/z++', zcxx)
  await $$`chmod +x /usr/local/bin/zcc /usr/local/bin/z++`
}

async function getGoVersion() {
  const goVersion = await $`go version`
  // go version go1.24.1 darwin/arm64
  const match = goVersion.stdout.match(/go(\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error('Failed to get go version')
  }
  return match[1]
}

async function setupWin7Go(input: Input) {
  const goVersion = await getGoVersion()
  const github_auth =
    input.github_token != undefined
      ? String.raw`-H "Authorization: Bearer ${input.github_token}"`
      : ''
  await $$`curl -fsSL ${github_auth} --retry 3 https://github.com/XTLS/go-win7/releases/download/patched-${goVersion}/go-for-win7-linux-amd64.zip -o go-win7.zip`
  await $$`unzip go-win7.zip -d ${cwd}/go-win7`
  await $$`rm go-win7.zip`
  return `${cwd}/go-win7/bin/go`
}

const zigTargetMap = {
  'windows7-386': 'x86-windows-gnu',
  'windows7-amd64': 'x86_64-windows-gnu'
} as Record<string, string>

const cwd = process.cwd()

registerEngine({
  targets: ['windows7-386', 'windows7-amd64'],
  async prepare(input) {
    await $$`sudo snap install zig --classic --beta`
    await setupWin7Go(input)
  },
  async run(input) {
    const target = input.target
    const arch = target.split('-')[1]
    const zigTarget = zigTargetMap[target]
    await setupZcx(zigTarget)
    await input.$({
      env: {
        CGO_ENABLED: '1',
        GOOS: 'windows',
        GOARCH: arch,
        CC: 'zcc',
        CXX: 'z++'
      }
    })`${cwd}/go-win7/bin/go build -o ${TempBinName}.exe ${calFlags(input.flags)} ${input.pkgs}`
  }
})
