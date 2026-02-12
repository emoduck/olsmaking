import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientAppRoot = path.resolve(scriptDirectory, '..')
const sourceRoot = path.join(clientAppRoot, 'src')
const allowlistPath = path.join(scriptDirectory, 'check-copy.allowlist.json')

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const excludedFilePatterns = [/\.test\./i, /\.spec\./i, /\.stories\./i]

const rules = [
  {
    id: 'for-a',
    pattern: /\bfor a\b/i,
    guidance: 'Use "for \u00e5" in Norwegian copy.',
  },
  {
    id: 'pa',
    pattern: /\bpa\b/i,
    guidance: 'Use "p\u00e5" in Norwegian copy.',
  },
  {
    id: 'apne',
    pattern: /\bApne\b/g,
    guidance: 'Use "\u00c5pne" in Norwegian copy.',
  },
  {
    id: 'apen',
    pattern: /\bApen\b/g,
    guidance: 'Use "\u00c5pen" or "\u00c5pent" in Norwegian copy.',
  },
  {
    id: 'brand',
    pattern: /\bOlsmaking\b/g,
    guidance: 'Use the product name "\u00d8lsmaking" in user-facing text.',
  },
  {
    id: 'ma',
    pattern: /\bma\b/i,
    guidance: 'Use "m\u00e5" in Norwegian copy.',
  },
  {
    id: 'vare',
    pattern: /\bvare\b/i,
    guidance: 'Use "v\u00e6re" in Norwegian copy.',
  },
  {
    id: 'enna',
    pattern: /\benna\b/i,
    guidance: 'Use "enn\u00e5" in Norwegian copy.',
  },
  {
    id: 'na',
    pattern: /\bna\b/i,
    guidance: 'Use "n\u00e5" in Norwegian copy.',
  },
  {
    id: 'forst',
    pattern: /\bforst\b/i,
    guidance: 'Use "f\u00f8rst" in Norwegian copy.',
  },
  {
    id: 'ol',
    pattern: /\bol\b/i,
    guidance: 'Use "\u00f8l" in Norwegian copy when referring to beer.',
  },
]

const allowlistDatePattern = /^\d{4}-\d{2}-\d{2}$/

function normalizeForCompare(value) {
  return value.replace(/\\r?\\n/g, '\\n').trim()
}

async function readAllowlist() {
  try {
    const raw = await readFile(allowlistPath, 'utf-8')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      throw new Error('Allowlist JSON must be an array.')
    }

    const validationErrors = []
    const normalizedEntries = []

    for (let index = 0; index < parsed.length; index += 1) {
      const entry = parsed[index]
      const pointer = `allowlist[${index}]`

      if (!entry || typeof entry !== 'object') {
        validationErrors.push(`${pointer} must be an object.`)
        continue
      }

      const { path: entryPath, ruleId, text, reason, expiresOn } = entry

      if (typeof entryPath !== 'string' || !entryPath.trim()) {
        validationErrors.push(`${pointer}.path must be a non-empty string.`)
      }

      if (typeof ruleId !== 'string' || !ruleId.trim()) {
        validationErrors.push(`${pointer}.ruleId must be a non-empty string.`)
      }

      if (typeof text !== 'string' || !text.trim()) {
        validationErrors.push(`${pointer}.text must be a non-empty string.`)
      }

      if (typeof reason !== 'string' || !reason.trim()) {
        validationErrors.push(`${pointer}.reason must be a non-empty string.`)
      }

      if (typeof expiresOn !== 'string' || !allowlistDatePattern.test(expiresOn)) {
        validationErrors.push(`${pointer}.expiresOn must use YYYY-MM-DD format.`)
      }

      if (
        typeof entryPath === 'string' &&
        entryPath.trim() &&
        typeof ruleId === 'string' &&
        ruleId.trim() &&
        typeof text === 'string' &&
        text.trim() &&
        typeof reason === 'string' &&
        reason.trim() &&
        typeof expiresOn === 'string' &&
        allowlistDatePattern.test(expiresOn)
      ) {
        normalizedEntries.push({
          path: entryPath,
          ruleId,
          text: normalizeForCompare(text),
          reason,
          expiresOn,
        })
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Invalid allowlist: ${validationErrors.join(' ')}`)
    }

    return normalizedEntries
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

function isAllowlisted(allowlistEntries, issue) {
  const issueText = normalizeForCompare(issue.segmentText)
  return allowlistEntries.some((entry) => entry.path === issue.path && entry.ruleId === issue.ruleId && entry.text === issueText)
}

function isExpiredAllowlistEntry(expiresOn) {
  const expirationInstant = Date.parse(`${expiresOn}T23:59:59Z`)
  if (Number.isNaN(expirationInstant)) {
    return true
  }

  return Date.now() > expirationInstant
}

function isExcludedFile(fileName) {
  return excludedFilePatterns.some((pattern) => pattern.test(fileName))
}

function normalizeRelativePath(filePath) {
  return path.relative(clientAppRoot, filePath).split(path.sep).join('/')
}

function extractSegmentsFromLine(line) {
  const segments = []

  const quotedTextPattern = /(["'`])((?:\\.|(?!\1).)*)\1/g
  for (const match of line.matchAll(quotedTextPattern)) {
    const text = match[2]
    if (!text.trim()) {
      continue
    }

    segments.push({
      text,
      startColumn: (match.index ?? 0) + 2,
    })
  }

  const jsxTextPattern = />([^<{]+)</g
  for (const match of line.matchAll(jsxTextPattern)) {
    const rawText = match[1]
    const text = rawText.trim()
    if (!text) {
      continue
    }

    const leadingOffset = rawText.indexOf(text)
    segments.push({
      text,
      startColumn: (match.index ?? 0) + 2 + leadingOffset,
    })
  }

  return segments
}

function findCopyIssues(relativePath, fileContents) {
  const issues = []
  const lines = fileContents.split(/\r?\n/)

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    const segments = extractSegmentsFromLine(line)

    for (const segment of segments) {
      for (const rule of rules) {
        rule.pattern.lastIndex = 0
        const match = rule.pattern.exec(segment.text)
        if (!match) {
          continue
        }

        issues.push({
          path: relativePath,
          line: lineIndex + 1,
          column: segment.startColumn + (match.index ?? 0),
          matchedText: match[0],
          segmentText: segment.text,
          ruleId: rule.id,
          guidance: rule.guidance,
        })
      }
    }
  }

  return issues
}

async function collectSourceFiles(directoryPath) {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true })
  const files = []

  for (const entry of directoryEntries) {
    const entryPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (isExcludedFile(entry.name)) {
      continue
    }

    const extension = path.extname(entry.name)
    if (!allowedExtensions.has(extension)) {
      continue
    }

    files.push(entryPath)
  }

  return files
}

async function run() {
  const sourceFiles = await collectSourceFiles(sourceRoot)
  const allowlistEntries = await readAllowlist()
  const expiredEntries = allowlistEntries.filter((entry) => isExpiredAllowlistEntry(entry.expiresOn))

  if (expiredEntries.length > 0) {
    console.error('Copy quality check failed: allowlist has expired entries:')
    for (const entry of expiredEntries) {
      console.error(
        `- ${entry.path} [${entry.ruleId}] expiresOn=${entry.expiresOn} reason="${entry.reason}"`,
      )
    }

    process.exitCode = 1
    return
  }

  const issues = []

  for (const filePath of sourceFiles) {
    const contents = await readFile(filePath, 'utf-8')
    const relativePath = normalizeRelativePath(filePath)
    for (const issue of findCopyIssues(relativePath, contents)) {
      if (isAllowlisted(allowlistEntries, issue)) {
        continue
      }

      issues.push(issue)
    }
  }

  if (issues.length === 0) {
    console.log('Copy quality check passed: no blocked transliterations found.')
    return
  }

  console.error(`Copy quality check failed with ${issues.length} issue(s):`)
  for (const issue of issues) {
    console.error(
      `- ${issue.path}:${issue.line}:${issue.column} [${issue.ruleId}] "${issue.matchedText}" - ${issue.guidance}`,
    )
  }

  process.exitCode = 1
}

run().catch((error) => {
  console.error('Copy quality check crashed.', error)
  process.exitCode = 1
})
