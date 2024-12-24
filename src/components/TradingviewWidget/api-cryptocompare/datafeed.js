import { makeApiRequest, generateSymbol, parseFullSymbol } from './helpers.js';
import { subscribeOnStream, unsubscribeFromStream } from './streaming.js';

const lastBarsCache = new Map();
const api_root = 'https://min-api.cryptocompare.com';

export const supported_resolutions = ['1', '2', '3', '10', '15', '30', '45',
   '60', '120', '240', '1D', '1W'];

// DatafeedConfiguration implementation
const configurationData = {
  supported_resolutions,
  supports_group_request: false,
  supports_marks: false,
  supports_search: true,
  supports_timescale_marks: false,
  exchanges: [
    {
      value: 'Bitfinex',
      name: 'Bitfinex',
      desc: 'Bitfinex',
    },
    {
      value: 'Binance',
      name: 'Binance',
      desc: 'Binance exchange',
    },
  ],
  symbols_types: [{ name: 'crypto', value: 'crypto' }],
  // supports_time: true,
};

// Obtains all symbols for all exchanges supported by CryptoCompare API
async function getAllSymbols() {
  const data = await makeApiRequest('data/v3/all/exchanges');
  let allSymbols = [];

  for (const exchange of configurationData.exchanges) {
    const pairs = data.Data[exchange.value].pairs;

    for (const leftPairPart of Object.keys(pairs)) {
      const symbols = pairs[leftPairPart].map((rightPairPart) => {
        const symbol = generateSymbol(exchange.value, leftPairPart, rightPairPart);
        return {
          symbol: symbol.short,
          full_name: symbol.full,
          description: symbol.short,
          exchange: exchange.value,
          type: 'crypto',
        };
      });
      allSymbols = [...allSymbols, ...symbols];
    }
  }
  return allSymbols;
}

export default {
  onReady: (callback) => {
    setTimeout(() => callback(configurationData));
  },

  searchSymbols: async (userInput, exchange, symbolType, onResultReadyCallback) => {
    // console.log('[searchSymbols]: Method call');
    const symbols = await getAllSymbols();
    const newSymbols = symbols.filter((symbol) => {
      const isExchangeValid = exchange === '' || symbol.exchange === exchange;
      const isFullSymbolContainsInput = symbol.full_name.toLowerCase().indexOf(userInput.toLowerCase()) !== -1;
      return isExchangeValid && isFullSymbolContainsInput;
    });
    onResultReadyCallback(newSymbols);
  },

  resolveSymbol: async (symbolName, onSymbolResolvedCallback, onResolveErrorCallback, extension) => {
    const symbols = await getAllSymbols();
    const symbolItem = symbols.find(({ full_name }) => full_name === symbolName);

    if (!symbolItem) {
      onResolveErrorCallback('cannot resolve symbol');
      return;
    }

    // override current url with parameters of new symbol
    let currentUrl = window.location.href;
    let url = new URL(currentUrl);
    url.searchParams.set('symbol', symbolItem.short);
    window.history.pushState({}, '', url);

    // Symbol information object
    const symbolInfo = {
      ticker: symbolItem.full_name,
      name: symbolItem.symbol,
      description: symbolItem.description,
      type: symbolItem.type,
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: symbolItem.exchange,
      minmov: 1,
      logo_urls: symbolItem.logo_urls?.reverse(),
      pricescale: 100,
      has_intraday: true,
      has_daily: true,
      // intraday_multipliers: ['1', '60'],
      // has_no_volume: true,
      has_weekly_and_monthly: false,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 2,
      data_status: 'streaming',
    };

    onSymbolResolvedCallback(symbolInfo);
  },

  getBars: async function (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
    const { from, to, firstDataRequest } = periodParams;
    // console.log('[getBars]: Method call', symbolInfo, resolution, from, to);
    const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
    const urlParameters = {
      e: parsedSymbol.exchange,
      fsym: parsedSymbol.fromSymbol,
      tsym: parsedSymbol.toSymbol,
      toTs: to,
      limit: 2000,
    };

    const query = Object.keys(urlParameters)
      .map((name) => `${name}=${encodeURIComponent(urlParameters[name])}`)
      .join('&');

    const url = resolution < 60 ? '/data/histominute' : resolution >= 60 ? '/data/histohour' : '/data/histoday';

    try {
      const response = await fetch(`${api_root}${url}?${query}`);

      const data = await response.json();

      if (data.Response && data.Response === 'Error') {
        onHistoryCallback([], { noData: true });
        return;
      }

      if (data.Data.length) {
        var bars = data.Data.map((el) => {
          return {
            time: el.time * 1000, // TradingView requires bar time in ms
            low: el.low,
            high: el.high,
            open: el.open,
            close: el.close,
            volume: el.volumefrom,
          };
        });

        if (firstDataRequest) {
          lastBarsCache.set(symbolInfo.full_name, { ...bars[bars.length - 1] });
        }

        onHistoryCallback(bars, {
          noData: false,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  },

  // getServerTime: async (callback) => {
  //    console.log('server time called', callback)
  //    fetch(`${baseApi}/time`).then(async (res) => {
  //       callback((await res.json())["serverTime"] / 1000);
  //    });
  //},

  subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
    // console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
    subscribeOnStream(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback,
      lastBarsCache.get(symbolInfo.full_name)
    );
  },

  unsubscribeBars: (subscriberUID) => {
    // console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
    unsubscribeFromStream(subscriberUID);
  },
};
