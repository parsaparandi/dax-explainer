exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { daxCode, level, mode, systemPrompt } = JSON.parse(event.body);

    if (!daxCode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing input' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    // Use system prompt passed from frontend, or build default
    const finalSystemPrompt = systemPrompt || `You are a Power BI and DAX expert.

Respond ONLY in this exact JSON format (no markdown):
{
  "summary": "plain English summary",
  "breakdown": [{ "code": "FUNCTION", "explanation": "what it does" }],
  "useCase": "when to use this with a business example"
}`;

    const userMessage = mode === 'generate'
      ? `Generate a DAX measure for this requirement: ${daxCode}`
      : `Explain this DAX measure:\n\n${daxCode}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: finalSystemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      return { statusCode: response.status, body: JSON.stringify({ error: errData.error?.message || 'API error' }) };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) clean = jsonMatch[0];
      parsed = JSON.parse(clean);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Could not parse response. Please try again.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
