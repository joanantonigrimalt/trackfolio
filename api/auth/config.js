export const config = { runtime: 'edge' };

export default (req) => {
  return new Response(
    JSON.stringify({
      supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
      supabaseAnonKey: (process.env.SUPABASE_ANON_KEY || '').trim(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
