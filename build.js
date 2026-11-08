#!/usr/bin/env node
// Builds maps/<slug>.json and index.json from outlines/<slug>.md. No dependencies.
// Usage: node build.js            build everything
//        node build.js --check    build nothing, just report problems
//
// An outline is a Markdown list, one root line, two-space indents. A label may carry one link:
//   - Plan a trip to Japan
//     - When to go
//       - [Cherry blossom](https://en.wikipedia.org/wiki/Cherry_blossom)
// Optional first lines: `category: Travel` files it in the directory (one of CATEGORIES), and
// `aliases: japan trip, visit japan` adds other ways people ask for it.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const MAX_WORDS = 7
// The directory's sections, in order: Wikipedia's Vital Articles top level, plus our own for
// doing things (Money and work, Learn a skill, Life and home, Travel)
export const CATEGORIES = [
  'Science', 'Health', 'Technology', 'History', 'Arts and culture', 'Society', 'Geography', 'Mathematics',
  'People', 'Philosophy and religion', 'Money and work', 'Learn a skill', 'Life and home', 'Travel'
]
const check = process.argv.includes('--check')

// How a search becomes a file name, and how mindstr finds a map: lower case, accents dropped,
// anything else between words becomes one hyphen. "Plan a Trip to Japan!" → plan-a-trip-to-japan
export const slug = text =>
  String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function parse(text, file) {
  const lines = text.split('\n')
  let aliases = []
  let category = null
  for (let m; (m = (lines[0] || '').match(/^(aliases|category):\s*(.*)$/i)); lines.shift()) {
    if (m[1].toLowerCase() === 'aliases') aliases = m[2].split(',').map(s => s.trim()).filter(Boolean)
    else category = m[2].trim()
  }
  const stack = []
  let root = null
  const problems = []
  for (const line of lines) {
    const m = line.match(/^( *)[-*] +(.+?)\s*$/)
    if (!m) {
      if (line.trim()) problems.push(`not a list line: ${line.trim()}`)
      continue
    }
    const depth = m[1].length / 2
    if (!Number.isInteger(depth)) problems.push(`odd indent: ${line}`)
    const link = m[2].match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    const node = { name: link ? link[1] : m[2], link: link?.[2], kids: [] }
    if (/\]\(/.test(node.name)) problems.push(`one link per line, as the whole label: ${m[2]}`)
    if (node.name.split(/\s+/).length > MAX_WORDS) problems.push(`more than ${MAX_WORDS} words: ${node.name}`)
    if (depth === 0) {
      if (root) problems.push('more than one root')
      root = node
    } else {
      const parent = stack[depth - 1]
      if (!parent) problems.push(`no parent for: ${node.name}`)
      else parent.kids.push(node)
    }
    stack[depth] = node
    stack.length = depth + 1
  }
  if (!root) problems.push('no root')
  if (!category) problems.push('no category: line')
  else if (!CATEGORIES.includes(category)) problems.push(`unknown category "${category}" (one of: ${CATEGORIES.join(', ')})`)
  return { root, aliases, category, problems: problems.map(p => `${file}: ${p}`) }
}

// Seeded ids, so rebuilding a map keeps its ids (mindstr's examples do the same)
function idMaker(key) {
  let seed = [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) | 0
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
  return () => '#' + Array.from({ length: 6 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('')
}

// Main-branch colours, as in mindstr's examples
const COLOURS = ['#D6E8FF', '#D9F2DC', '#FFE1CC', '#FFD6E8', '#FFF3C4', '#E6E0FF', '#D4F1F4']
const leaves = t => Math.max(1, t.kids.reduce((s, k) => s + leaves(k), 0))

// The radial layout of mindstr's scripts/build-examples.js: nodes in tree order, each branch an
// arc in proportion to its leaves, then overlaps pushed outward.
function layout(root, key) {
  const newId = idMaker(key)
  const nodes = []
  const connections = []
  const add = (t, parent, a0, a1, depth, colour) => {
    const mid = (a0 + a1) / 2
    const r = depth === 0 ? 0 : 230 + (depth - 1) * 220
    nodes.push({
      '@id': depth === 0 ? '#this' : newId(),
      name: t.name,
      x: Math.round(r * Math.cos(mid)),
      y: Math.round(r * Math.sin(mid) * 0.8),
      ...(t.link && { link: t.link }),
      ...(depth === 1 && { bgColor: colour })
    })
    const i = nodes.length - 1
    if (parent !== null) connections.push({ start: parent, end: i })
    const total = t.kids.reduce((s, k) => s + leaves(k), 0)
    let a = a0
    t.kids.forEach((k, j) => {
      const span = ((a1 - a0) * leaves(k)) / total
      add(k, i, a, a + span, depth + 1, depth === 0 ? COLOURS[j % COLOURS.length] : colour)
      a += span
    })
  }
  add(root, null, -Math.PI, Math.PI, 0)
  const w = n => Math.max(8.5 * [...n.name].length + 40 + (n.link ? 18 : 0), 56)
  const clash = (a, b) => Math.abs(a.x - b.x) < (w(a) + w(b)) / 2 + 24 && Math.abs(a.y - b.y) < 36 + 12
  nodes.forEach((n, i) => {
    const a = Math.atan2(n.y / 0.8, n.x)
    for (let t = 0; i > 0 && t < 60 && nodes.slice(0, i).some(m => clash(n, m)); t++) {
      n.x = Math.round(n.x + 20 * Math.cos(a))
      n.y = Math.round(n.y + 16 * Math.sin(a))
    }
  })
  for (const { start, end } of connections) nodes[end].parent = nodes[start]['@id']
  return {
    '@context': { '@vocab': 'https://mindstr.org/ns#', link: { '@type': '@id' }, parent: { '@type': '@id' } },
    version: '0.2',
    nodes,
    connections,
    selectedNode: 0
  }
}

const files = readdirSync('outlines').filter(f => f.endsWith('.md')).sort()
const index = []
const problems = []
const seen = new Map()
for (const file of files) {
  const { root, aliases, category, problems: p } = parse(readFileSync(`outlines/${file}`, 'utf8'), file)
  problems.push(...p)
  if (!root) continue
  const key = file.replace(/\.md$/, '')
  if (key !== slug(root.name)) problems.push(`${file}: file name should be ${slug(root.name)}.md`)
  const names = new Set([root.name])
  const dupes = []
  const walk = t => t.kids.forEach(k => (names.has(k.name) ? dupes.push(k.name) : names.add(k.name), walk(k)))
  walk(root)
  if (dupes.length) problems.push(`${file}: repeated labels: ${dupes.join(', ')}`)
  for (const s of [key, ...aliases.map(slug)]) {
    if (seen.has(s) && seen.get(s) !== key) problems.push(`${file}: "${s}" is already ${seen.get(s)}`)
    seen.set(s, key)
  }
  const map = layout(root, key)
  if (!check) writeFileSync(`maps/${key}.json`, JSON.stringify(map, null, 2) + '\n')
  index.push({ topic: root.name, slug: key, category, aliases: aliases.map(slug).filter(a => a !== key), file: `maps/${key}.json`, nodes: map.nodes.length })
}
if (!check) {
  // every way to ask → the map's file, for a one-fetch lookup
  const lookup = Object.fromEntries([...seen].sort().map(([s, key]) => [s, `maps/${key}.json`]))
  const categories = CATEGORIES.map(name => ({ name, maps: index.filter(m => m.category === name).length })).filter(c => c.maps)
  writeFileSync('index.json', JSON.stringify({ version: 1, categories, maps: index, lookup }, null, 2) + '\n')
}
console.log(`${index.length} maps, ${index.reduce((s, m) => s + m.nodes, 0)} nodes, ${problems.length} problems`)
for (const p of problems) console.log('  ' + p)
process.exit(problems.length ? 1 : 0)
