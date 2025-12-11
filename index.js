const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
// Middleware to parse JSON bodies from Meta webhooks
app.use(express.json());

// --- ENVIRONMENT VARIABLES (Read from Railway Settings) ---
// IMPORTANT: These variables MUST be set in your Railway project's Variables tab.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const PORT = process.env.PORT || 3000;

// --- FAQ DATA (Customize Your Answers Here) ---
const FAQ_DATA = {
  1: "✅ Timings: Our business hours are Monday to Friday, 9:00 AM to 5:00 PM.",
  2: "💰 Prices: Our basic membership starts at $20/hour. Please visit our website for full details on package pricing.",
  3: "🗓️ Booking: To book a meeting room, please visit the booking section on our website (Vantage.com/booking) or contact our desk team.",
  4: "📍 Location: We are located at 123 Vantage Tower, Business District, City Center.",
  DEFAULT_REPLY:
    "I did not recognize that option. Please reply with a number from the menu (1, 2, 3, or 4).",
};

// --- WHATSAPP API CALL ---
async function sendWhatsAppMessage(recipientId, messagePayload) {
  try {
    // Construct the full URL for the Cloud API
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

    await axios.post(url, messagePayload, {
      headers: {
        // Use the access token from Railway Variables
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error(
      "Error sending message to WhatsApp:",
      error.response ? error.response.data : error.message
    );
  }
}

// --- MESSAGE PAYLOADS ---

// 1. Sends the Interactive List Message Menu
function getMenuMessagePayload(recipientId) {
  return {
    messaging_product: "whatsapp",
    to: recipientId,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Hello👋 <span> Thank you for contacting Daftarkhwan North.",
      },
      body: {
        text: "Please select one of the options below so we can guide you better:",
      },
      action: {
        button: "Select an Option",
        sections: [
          {
            title: "Vantage FAQs",
            rows: [
              { id: "1", title: "1 – Service & Pricing Information" },
              { id: "2", title: "2 – Book a Visit / Appointment" },
              { id: "3", title: "3 – Report an Issue or Submit a Query" },
              { id: "4", title: "4 – Membership Details & Queries" },
              {
                id: "5",
                title: "5 – Talk to a Representative (Next Business Day)",
              },
            ],
          },
        ],
      },
    },
  };
}

// 2. Sends a simple text message response
function getTextMessagePayload(recipientId, text) {
  return {
    messaging_product: "whatsapp",
    to: recipientId,
    type: "text",
    text: { body: text },
  };
}

// --- WEBHOOK ENDPOINT (POST) ---
// This is where Meta sends messages from your users
app.post("/webhook", (req, res) => {
  const body = req.body;

  // Check if the webhook is for an incoming WhatsApp message
  if (body.object === "whatsapp_business_account") {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const recipientId = message.from;
      let responseText = FAQ_DATA.DEFAULT_REPLY;

      // --- CORE BOT LOGIC ---

      // 1. Check if the message is an interactive reply (a button selection)
      if (
        message.type === "interactive" &&
        message.interactive.type === "list_reply"
      ) {
        const selectedOption = message.interactive.list_reply.id;
        responseText = FAQ_DATA[selectedOption] || FAQ_DATA.DEFAULT_REPLY;

        // 2. Check if the message is simple text
      } else if (message.type === "text") {
        const userText = message.text.body.trim();

        // If user types a number ('1', '2', etc.)
        if (FAQ_DATA[userText]) {
          responseText = FAQ_DATA[userText];
        }

        // If user sends any other text, send the menu again
        else {
          sendWhatsAppMessage(recipientId, getMenuMessagePayload(recipientId));
          return res.sendStatus(200);
        }
      }

      // If we have a final response, send it back as a simple text message
      const faqReplyPayload = getTextMessagePayload(recipientId, responseText);
      sendWhatsAppMessage(recipientId, faqReplyPayload);
    }

    // Always send the Interactive Menu Message on any new conversation start (if a message was received)
    if (message) {
      // Send the menu after replying, to keep the options visible
      sendWhatsAppMessage(message.from, getMenuMessagePayload(message.from));
    }

    return res.sendStatus(200);
  }

  // For any other event, return 404
  res.sendStatus(404);
});

// --- WEBHOOK VERIFICATION ENDPOINT (GET) ---
// This is the initial check Meta performs when you set up the webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Check the mode and verify token against the one set in Railway variables
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified!");
    res.status(200).send(challenge);
  } else {
    // Forbidden
    res.sendStatus(403);
  }
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
