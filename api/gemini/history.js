import supabase from '../lib/supabase';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'x-session-id');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing x-session-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('chats')
            .select('session_id, history')
            .eq('session_id', sessionId);

        if (error) {
            throw new Error(error.message);
        }

        return res.status(200).json({ history: data || [] });
    } catch (error) {
        console.error('Supabase error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch history: ' + error.message });
    }
}
