import { calFlags } from '../src/utils'

const flags = calFlags({
  flags: '-ldflags="-s -w"',
  extra: {
    '-ldflags': {
      values: ["-X 'main.a=1'", "'-X main.b=2'"],
      separator: ' ',
      connector: '=',
      quote: '"'
    },
    '-o': {
      values: ['main'],
      connector: ' ',
      quote: '"'
    }
  }
})

console.log(flags)
