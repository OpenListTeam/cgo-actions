import { $ } from 'execa'
import { Engine, Flags, Input } from './types'

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

export function getGoBuildTagsArgs(tags: string) {
  if (!tags) {
    return []
  }
  return ['-tags', tags]
}

export function getXgoTagsArgs(tags: string) {
  if (!tags) {
    return []
  }
  return [`-tags=${tags}`]
}
