import { LexRuntimeV2Client, RecognizeTextCommand } from "@aws-sdk/client-lex-runtime-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";

// These match the working demo bot. Move to a .env file
// (VITE_LEX_BOT_ID etc.) before this ever ships to production so the values
// aren't hardcoded in source - functionally the same either way since the
// Identity Pool ID isn't a secret, but env vars make it easier to point at a
// different bot per environment (dev/staging/prod) without code changes.
const BOT_ID = import.meta.env.VITE_LEX_BOT_ID || "RGMEMASG0O";
const BOT_ALIAS_ID = import.meta.env.VITE_LEX_BOT_ALIAS_ID || "TSTALIASID";
const LOCALE_ID = import.meta.env.VITE_LEX_LOCALE_ID || "en_US";
const COGNITO_POOL_ID =
  import.meta.env.VITE_LEX_COGNITO_POOL_ID || "ap-southeast-2:85e70438-187c-4713-8db5-d851e096ed3c";
const REGION = import.meta.env.VITE_LEX_REGION || "ap-southeast-2";

const lexClient = new LexRuntimeV2Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({ region: REGION }),
    identityPoolId: COGNITO_POOL_ID,
  }),
});

/**
 * Sends a message to the RippleBox Lex bot and returns the bot's reply text.
 * Mirrors the working recognizeText() call from the standalone demo.
 */
export async function sendMessageToLex(message: string, sessionId: string): Promise<string> {
  try {
    const command = new RecognizeTextCommand({
      botId: BOT_ID,
      botAliasId: BOT_ALIAS_ID,
      localeId: LOCALE_ID,
      sessionId,
      text: message,
    });

    const response = await lexClient.send(command);
    const messages = response.messages ?? [];

    if (messages.length > 0) {
      return messages.map((m) => m.content).join("\n");
    }
    return "I'm not sure about that. Please contact RippleBox support! 😊";
  } catch (err) {
    console.error("Lex error:", err);
    return "Connection error reaching the chatbot. Please try again! 🙏";
  }
}
