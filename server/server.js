// Backend: Node.js (Express)
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
// const fetch = require("node-fetch");
require("dotenv").config();
const router = express.Router();
const { verifyPayment } = require('./verification');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

const generateSignature = (data, passPhrase = null) => {
  let pfOutput = "";
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      if (data[key] !== "") {
        pfOutput += `${key}=${encodeURIComponent(data[key].trim())}&`;
      }
    }
  }

  let getString = pfOutput.slice(0, -1);

  if (passPhrase !== null) {
    getString += `&passphrase=${encodeURIComponent(passPhrase.trim())}`;
  }

  return crypto.createHash("md5").update(getString).digest("hex");
};

app.post("/hashData", (req, res) => {
  // Assuming req.body contains the data for which signature needs to be generated
  const data = req.body;
  
  // Assuming passphrase is sent in the request body as well
   //const passPhrase = req.body.passphrase;
  // const passPhrase = "jt7NOE43FZPn";
   const signature = generateSignature(data);
  //  const signature = generateSignature(data, passPhrase);
  
  res.json({ signature: signature });
});

app.post('/verify-payment', async (req, res) => {
  const paymentData = req.body; // Get the payment data from the request body
  const cartTotal = 10.00; // Replace with the actual cart total

  try {
    const verificationResult = await verifyPayment(req, cartTotal, paymentData);

    if (verificationResult) {
      console.log('Payment is successful');
      res.json({ success: true });
    } else {
      console.log('Payment failed, investigate manually');
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`PayFast payment gateway listening at http://localhost:${port}`);
});
