import { $ } from 'execa'
import { Engine, Flags, Input } from './types'
import fs from 'fs'

export function engineKey(engine: Engine) {
  return engine.targets.join(',')
}

export const TempBinName = 'go-cross-bin'

export function getTempBinPath(input: Input) {
  return (
    `${input.dir}/` +
    (input.target.includes('windows') ? `${TempBinName}.exe` : TempBinName)
  )
}

export const $$ = $({ stdio: 'inherit' })

export function arrMinus<T>(arr: T[], ...items: T[]) {
  return arr.filter(i => !items.includes(i))
}

export function mapRev(obj: Record<string, string>) {
  const rev = {} as Record<string, string>
  for (const [k, v] of Object.entries(obj)) {
    rev[v] = k
  }
  return rev
}

export function calFlags(flags: Flags) {
  let res = flags.flags
  for (const [
    key,
    { values, separator, connector: connect, quote }
  ] of Object.entries(flags.extra)) {
    if (separator) {
      const merged = values.join(separator)
      const index_str = key + connect + quote
      if (res.includes(index_str)) {
        const insertIndex = res.indexOf(key)
        res =
          res.slice(0, insertIndex + index_str.length) +
          merged +
          separator +
          res.slice(insertIndex + index_str.length)
      } else {
        res += ` ${key}${connect}${quote}${merged}${quote}`
      }
    } else {
      values.forEach(value => {
        res += ` ${key}${connect}${quote}${value}${quote}`
      })
    }
  }
  return res
}

export async function setupMacOSSDK() {
  const OSX_SDK = 'MacOSX15.5.sdk'
  const OSX_SDK_URL = `https://github.com/joseluisq/macosx-sdks/releases/download/15.5/${OSX_SDK}.tar.xz`
  // Download and extract the SDK
  if (!fs.existsSync(`/opt/${OSX_SDK}`)) {
    console.log(`Downloading macOS SDK from ${OSX_SDK_URL}...`)
    const sdkFile = `/tmp/${OSX_SDK}.tar.xz`
    await $$`curl -L -o ${sdkFile} ${OSX_SDK_URL}`
    console.log(`Extracting macOS SDK to /opt/${OSX_SDK}...`)
    await $$`sudo tar -xf ${sdkFile} -C /opt`
    fs.rmSync(sdkFile)
  }
  // return bin path and lib path
  return {
    bin: `/opt/${OSX_SDK}/usr/bin`,
    lib: `/opt/${OSX_SDK}/usr/lib`,
    include: `/opt/${OSX_SDK}/usr/include`,
    sdk: `/opt/${OSX_SDK}`
  }
}
