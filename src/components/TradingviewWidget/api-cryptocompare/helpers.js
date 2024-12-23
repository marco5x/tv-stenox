// This is a simple implementation of the CryptoCompare streaming API
// https://github.com/tradingview/charting-library-tutorial

export const apiKey = import.meta.env.VITE_CCDATA_API_KEY;
// Makes requests to CryptoCompare API
export async function makeApiRequest(path) {
	try {
		const url = new URL(`https://min-api.cryptocompare.com/${path}`);
		url.searchParams.append('api_key', apiKey)
		const response = await fetch(url.toString());
		return response.json();
	} catch (error) {
		throw new Error(`CryptoCompare request error: ${error.status}`);
	}
}

export function generateSymbol(exchange, fromSymbol, toSymbol) {
	const short = `${fromSymbol}/${toSymbol}`;
	return {
		short,
		full: `${exchange}:${short}`,
	};
}

// Returns all parts of the symbol
export function parseFullSymbol(fullSymbol) {
	const match = fullSymbol.match(/^(\w+):(\w+)\/(\w+)$/);
	if (!match) return null;

	return {
		exchange: match[1],
		fromSymbol: match[2],
		toSymbol: match[3],
	};
}