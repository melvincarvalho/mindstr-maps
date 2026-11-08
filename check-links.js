#!/usr/bin/env node
// Checks every link in outlines/*.md opens (HTTP 200 after redirects). Slow and polite on purpose:
// one request at a time, a User-Agent, and a wait and retry when a site says 429.
// Usage: node check-links.js [outline.md ...]    (default: all outlines)

import { readdirSync, readFileSync } from 'node:fs'

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => f.replace(/^outlines\//, ''))
  : readdirSync('outlines').filter(f => f.endsWith('.md')).sort()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const UA = 'mindstr-maps link check (https://github.com/melvincarvalho/mindstr-maps)'

async function status(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
      if (res.status !== 429) return res.status
    } catch (e) {
      if (attempt === 3) return e.name
    }
    await sleep(2000 * (attempt + 1))
  }
  return 429
}

let bad = 0
let count = 0
for (const file of files) {
  const links = [...readFileSync(`outlines/${file}`, 'utf8').matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1])
  for (const url of links) {
    count++
    const code = await status(url)
    if (code !== 200) {
      bad++
      console.log(`${file}: ${code} ${url}`)
    }
    await sleep(300)
  }
}
console.log(`${count} links in ${files.length} outlines, ${bad} broken`)
process.exit(bad ? 1 : 0)
