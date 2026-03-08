import { NextResponse } from 'next/server';

export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

  return NextResponse.json({
    status: 'ok',
    version: '3.0.0',
    llm: {
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      configured: hasKey
    },
    timestamp: new Date().toISOString()
  });
}
