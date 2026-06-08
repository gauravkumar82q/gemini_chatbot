require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();

const PORT = Number(process.env.PORT) || 5500;
const API_KEY = process.env.GEMINI_API_KEY;
const API_BASE_URL = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_FALLBACKS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash')
	.split(',')
	.map((model) => model.trim())
	.filter(Boolean);

const MAX_RETRIES_PER_MODEL = 3;
const INITIAL_RETRY_DELAY_MS = 1200;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'Gemini chatbot')));

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

app.post('/api/chat', async (req, res) => {
	if (!API_KEY) {
		return res.status(500).json({
			error: 'Server missing GEMINI_API_KEY. Add it in .env file.'
		});
	}

	const prompt = String(req.body?.prompt || '').trim();
	if (!prompt) {
		return res.status(400).json({ error: 'Prompt is required.' });
	}

	let lastError = null;

	for (const model of MODEL_FALLBACKS) {
		for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt += 1) {
			let response;

			try {
				response = await fetch(`${API_BASE_URL}/${model}:generateContent?key=${API_KEY}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: prompt
									}
								]
							}
						]
					})
				});
			} catch (error) {
				return res.status(502).json({
					error: 'Network error while contacting Gemini API.'
				});
			}

			if (response.ok) {
				const data = await response.json();
				const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

				if (!text) {
					return res.status(502).json({
						error: 'Gemini returned an empty response.'
					});
				}

				return res.json({ text });
			}

			const errorBody = await response.text();
			lastError = {
				status: response.status,
				message: errorBody
			};

			if (![429, 503].includes(response.status)) {
				return res.status(response.status).json({
					error: `Gemini API error (${response.status}).`
				});
			}

			if (attempt < MAX_RETRIES_PER_MODEL) {
				const retryDelay = INITIAL_RETRY_DELAY_MS * (2 ** attempt);
				await delay(retryDelay);
			}
		}
	}

	if (lastError?.status === 429) {
		return res.status(429).json({
			error: 'Rate limit reached. Please wait and try again.'
		});
	}

	if (lastError?.status === 503) {
		return res.status(503).json({
			error: 'Gemini is busy right now. Please retry in a few seconds.'
		});
	}

	return res.status(500).json({
		error: 'Failed to generate response.'
	});
});

app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'Gemini chatbot', 'index.html'));
});

app.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`);
});
