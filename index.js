require('dotenv').config();
const tf = require('@tensorflow/tfjs-node');
const Binance = require('node-binance-api');

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_APIKEY,
  APISECRET: process.env.BINANCE_APISECRET
});

const [,,pair, intvl] = process.argv;
const sequenceLength = 24;
const batchSize = 32;
const epochs = 150;
const coinPair = typeof pair !== 'undefined' ? pair.toString().toUpperCase() : 'BTCUSDT';
const interval = typeof intvl !== 'undefined' ? intvl.toString() : '1h';
const learningRate = '0.01';

// Get price data for a cryptocurrency
binance.candlesticks(coinPair, interval, (error, ticks) => {
  if (error) {
    console.log(`Error: ${error}`);
  } else {
    // Prepare data for training
    const data = ticks.slice(-sequenceLength - batchSize).map(tick => parseFloat(tick[4]));
    const xs = [];
    const ys = [];
    for (let i = 0; i < data.length - sequenceLength; i++) {
      const x = data.slice(i, i + sequenceLength);
      const y = data[i + sequenceLength];
      xs.push(x);
      ys.push(y);
    }
    const input = tf.tensor2d(xs);
    const output = tf.tensor1d(ys);

    // Define and train model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 100000, inputShape: [sequenceLength],  activation: 'relu'}));
    model.add(tf.layers.dense({ units: 1 }));

    model.compile({ 
        optimizer: tf.train.adam(learningRate), 
        loss:  tf.metrics.meanAbsoluteError,
        metrics: ['mae']
    });

    model.fit(input, output, { batchSize, epochs }).then(() => {
      // Make a price prediction
      const latestData = data.slice(-sequenceLength);
      const input = tf.tensor2d([latestData]);
      const prediction = model.predict(input).dataSync()[0];
      const latestPrice = parseFloat(ticks[ticks.length - 1][4]);
      const nextPrice = latestPrice + prediction;
      const formattedPrice = nextPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      console.log(`\n====================\n`);
      console.log(`Next ${coinPair} price prediction: ${formattedPrice}`);
      console.log(`\n====================\n`);
    });
  }
});
