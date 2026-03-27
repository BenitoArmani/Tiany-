import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

const LANG_NAMES: Record<string, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic',
  ru: 'Russian', nl: 'Dutch', pl: 'Polish', sv: 'Swedish', tr: 'Turkish',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { heading, blocks, lang = 'fr' } = await req.json()
  const langName = LANG_NAMES[lang] ?? 'French'

  const existingContent = (blocks ?? [])
    .filter((b: { type: string; text: string }) => b.text?.trim())
    .map((b: { type: string; text: string }) => `[${b.type.toUpperCase()}] ${b.text}`)
    .join('\n')

  const userPrompt = existingContent
    ? `Scene: ${heading || 'Untitled'}\n\nExisting content:\n${existingContent}\n\nContinue this scene.`
    : `Scene: ${heading || 'Untitled'}\n\nWrite the opening of this scene.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      thinking: { type: 'adaptive' },
      system: `You are a professional screenplay writer. Generate 3–6 screenplay blocks to continue or open the given scene.
Output ONLY a valid JSON array — no markdown, no explanation, no text outside the array.
Format: [{"type":"action","text":"..."},{"type":"character","text":"NAME"},{"type":"dialogue","text":"..."}]
Valid types: action | character | dialogue | parenthetical | transition
Rules:
- character: uppercase name only, no dialogue in same block
- parenthetical: short direction inside parentheses, e.g. "(à voix basse)"
- transition: e.g. "COUPE SUR :" or "FONDU AU NOIR."
- action: present tense, vivid
- Write everything in ${langName}. Match the tone and style of existing content if any.`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json({ error: 'No text in response' }, { status: 500 })
    }

    const match = textBlock.text.match(/\[[\s\S]*?\]/)
    if (!match) {
      return Response.json({ error: 'Could not parse blocks', raw: textBlock.text }, { status: 500 })
    }

    const parsedBlocks = JSON.parse(match[0])
    return Response.json({ blocks: parsedBlocks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
