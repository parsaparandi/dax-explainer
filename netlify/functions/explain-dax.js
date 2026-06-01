// netlify/functions/explain-dax.js
// This is the backend that keeps your API key safe
 
const fetch = require('node-fetch');
 
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
 
  try {
    const { daxCode, level } = JSON.parse(event.body);
 
    if (!daxCode || !level) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing daxCode or level' })
      };
    }
 
    // Get API key from environment variable (set in Netlify dashboard)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }
 
    const levelPrompt = {
      simple: 'Explain using very simple language — assume the reader has never seen DAX before. Use everyday analogies.',
      intermediate: 'Explain clearly for someone who understands Power BI basics but wants to understand this specific measure deeply.',
      technical: 'Give a technical deep-dive — explain filter context, row context, evaluation order, and any DAX engine behavior relevant to this measure.'
    }[level] || 'Explain clearly and accurately.';
 
    const systemPrompt = `You are a Power BI and DAX expert who explains DAX measures clearly and accurately. ${levelPrompt}
 
Always respond in this EXACT JSON format (no markdown, pure JSON):
{
  "summary": "2-3 sentence plain English summary of what this measure calculates",
  "breakdown": [
    { "code": "FUNCTION_NAME", "explanation": "what this part does" },
    { "code": "ANOTHER_PART", "explanation": "what this does" }
  ],
  "useCase": "When and why you'd use this measure. Include a concrete business example."
}`;
 
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Explain this DAX measure:\n\n${daxCode}`
          }
        ]
      })
    });
 
    if (!response.ok) {
      const errData = await response.json();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: errData.error?.message || 'API error' })
      };
    }
 
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
 
    // Parse JSON
    let parsed;
    try {
      let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      parsed = JSON.parse(clean);
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not parse response', raw: text })
      };
    }
 
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(parsed)
    };
 
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
