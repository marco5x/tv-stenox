import { parseFullSymbol, apiKey } from './helpers.js';

const socket = new WebSocket(`wss://streamer.cryptocompare.com/v2?api_key=${apiKey}`);
const channelToSubscription = new Map();

socket.addEventListener('open', () => {
    console.log('[socket] Connected');
});

socket.addEventListener('close', (reason) => {
    console.log('[socket] Disconnected:', reason);
});

socket.addEventListener('error', (error) => {
    console.log('[socket] Error:', error);
});

socket.addEventListener('message', (event) => {    
    const data = JSON.parse(event.data);
    const {
        TYPE: eventTypeStr,
        M: exchange,
        FSYM: fromSymbol,
        TSYM: toSymbol,
        TS: tradeTimeStr,
        P: tradePriceStr,
    } = data;

    if (parseInt(eventTypeStr) !== 0) return;

    const tradePrice = parseFloat(tradePriceStr);
    const tradeTime = parseInt(tradeTimeStr);
    const channelString = `0~${exchange}~${fromSymbol}~${toSymbol}`;
    const subscriptionItem = channelToSubscription.get(channelString);

    if (!subscriptionItem) return;  // Return if no subscription is found

    const lastBar = subscriptionItem.lastDailyBar;

    let bar;
    // Handle 1 minute resolution (use tradeTime directly as time for new bar)
    if (lastBar && tradeTime >= lastBar.time / 1000 + 60) {
        bar = {
            time: tradeTime * 1000,
            open: tradePrice,
            high: tradePrice,
            low: tradePrice,
            close: tradePrice,
        };
        // console.log('[socket] Generate new 1-minute bar', bar);
    } else {
        bar = {
            ...lastBar,
            high: Math.max(lastBar.high, tradePrice),
            low: Math.min(lastBar.low, tradePrice),
            close: tradePrice,
        };
    }

    subscriptionItem.lastDailyBar = bar;
    subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
});

// function getNextDailyBarTime(barTime) {
//     const date = new Date(barTime * 1000);
//     date.setDate(date.getDate() + 1);
//     return date.getTime() / 1000;
// }

export function subscribeOnStream(
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscriberUID,
    onResetCacheNeededCallback,
    lastDailyBar
) {
    const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
    const channelString = `0~${parsedSymbol.exchange}~${parsedSymbol.fromSymbol}~${parsedSymbol.toSymbol}`;
    const handler = {
        id: subscriberUID,
        callback: onRealtimeCallback,
    };
    let subscriptionItem = channelToSubscription.get(channelString);
    if (subscriptionItem) {
        // Already subscribed to the channel, use the existing subscription
        subscriptionItem.handlers.push(handler);
        return;
    }
    subscriptionItem = {
        subscriberUID,
        resolution,
        lastDailyBar,
        handlers: [handler],
    };
    channelToSubscription.set(channelString, subscriptionItem);
    // console.log('[subscribeBars]: Subscribe to streaming. Channel:', channelString );
    const subRequest = {
        action: 'SubAdd',
        subs: [channelString],
    };
    socket.send(JSON.stringify(subRequest));
}

export function unsubscribeFromStream(subscriberUID) {
    // Find a subscription with id === subscriberUID
    for (const channelString of channelToSubscription.keys()) {
        const subscriptionItem = channelToSubscription.get(channelString);
        const handlerIndex = subscriptionItem.handlers.findIndex(
            (handler) => handler.id === subscriberUID
        );

        if (handlerIndex !== -1) {
            // Remove from handlers
            subscriptionItem.handlers.splice(handlerIndex, 1);

            if (subscriptionItem.handlers.length === 0) {
                // Unsubscribe from the channel if it was the last handler
                // console.log('[unsubscribeBars]: Unsubscribe from streaming. Channel:', channelString);
                const subRequest = {
                    action: 'SubRemove',
                    subs: [channelString],
                };
                socket.send(JSON.stringify(subRequest));
                channelToSubscription.delete(channelString);
                break;
            }
        }
    }
}
