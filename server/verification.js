const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const dns = require('dns');

function ipLookup(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses);
      }
    });
  });
}

const pfValidIP = async (req) => {
  const validHosts = [
    'www.payfast.co.za',
    'sandbox.payfast.co.za',
    'w1w.payfast.co.za',
    'w2w.payfast.co.za'
  ];

  let validIps = [];
  const pfIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    for (let key in validHosts) {
      const ips = await ipLookup(validHosts[key]);
      validIps = [...validIps, ...ips];
    }
  } catch (err) {
    console.error(err);
  }

  const uniqueIps = [...new Set(validIps)];

  if (uniqueIps.includes(pfIp)) {
    return true;
  }
  return false;
};

const pfValidPaymentData = (cartTotal, pfData) => {
  return Math.abs(parseFloat(cartTotal) - parseFloat(pfData['amount_gross'])) <= 0.01;
};

const pfValidServerConfirmation = async (pfHost, pfParamString) => {
  const result = await axios.post(`https://${pfHost}/eng/query/validate`, pfParamString)
    .then(res => res.data)
    .catch(error => {
      console.error(error);
    });
  return result === 'VALID';
};

async function verifyPayment(req, cartTotal, paymentData) {
  const testingMode = true;
  const pfHost = testingMode ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  const passPhrase = process.env.PAYFAST_PASSPHRASE;

  const pfValidSignature = (pfData, pfParamString, pfPassphrase = null) => {
    let tempParamString = pfParamString;
    if (pfPassphrase !== null) {
      tempParamString += `&passphrase=${encodeURIComponent(pfPassphrase.trim()).replace(/%20/g, '+')}`;
    }

    const signature = crypto.createHash('md5').update(tempParamString).digest('hex');
    return pfData['signature'] === signature;
  };

  const pfParamString = '';
  for (let key in paymentData) {
    if (paymentData.hasOwnProperty(key) && key !== 'signature') {
      pfParamString += `${key}=${encodeURIComponent(paymentData[key].trim()).replace(/%20/g, '+')}&`;
    }
  }

  pfParamString = pfParamString.slice(0, -1);

  const check1 = pfValidSignature(paymentData, pfParamString, passPhrase);
  const check2 = await pfValidIP(req);
  const check3 = pfValidPaymentData(cartTotal, paymentData);
  const check4 = await pfValidServerConfirmation(pfHost, pfParamString);

  if (check1 && check2 && check3 && check4) {
    return true; // All checks have passed, the payment is successful
  } else {
    return false; // Some checks have failed, check payment manually and log for investigation
  }
}

module.exports = {
  verifyPayment
};