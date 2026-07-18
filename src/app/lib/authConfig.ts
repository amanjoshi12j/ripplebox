import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AuthFlowType,
  ChallengeNameType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// Same fallback pattern as lexConfig.ts: these values aren't secrets (a
// Cognito app client ID is meant to be public, same as a Lex bot ID), so
// hardcoded fallbacks are fine until this points at a per-environment .env.
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "35q9pcn035fpje2ns3f09foskh";
const REGION = import.meta.env.VITE_COGNITO_REGION || "ap-southeast-2";

// SignUp/ConfirmSignUp/InitiateAuth are Cognito's "unauthenticated" public
// API actions - they don't require a valid AWS credential, just a client ID.
// The SDK still SigV4-signs requests, so we hand it a throwaway credential
// pair purely to satisfy the client constructor; Cognito ignores it for
// these specific actions. This is the standard browser pattern for a
// Cognito User Pool app client with no client secret.
const client = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: { accessKeyId: "unused", secretAccessKey: "unused" },
});

export type UserRole = "client" | "salon_owner";

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  salonName?: string;
  businessAddress?: string;
}

export async function signUp(params: SignUpParams): Promise<{ userSub: string }> {
  const userAttributes = [
    { Name: "email", Value: params.email },
    { Name: "name", Value: params.name },
    { Name: "custom:role", Value: params.role },
  ];
  if (params.phone) userAttributes.push({ Name: "phone_number", Value: params.phone });
  if (params.role === "salon_owner") {
    if (params.salonName) userAttributes.push({ Name: "custom:salon_name", Value: params.salonName });
    if (params.businessAddress)
      userAttributes.push({ Name: "custom:business_address", Value: params.businessAddress });
  }

  const result = await client.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: params.email,
      Password: params.password,
      UserAttributes: userAttributes,
    })
  );

  return { userSub: result.UserSub! };
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await client.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    })
  );
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await client.send(new ResendConfirmationCodeCommand({ ClientId: CLIENT_ID, Username: email }));
}

// Same "unauthenticated public action" category as SignUp/ConfirmSignUp
// above - Cognito emails a reset code, no existing session needed.
export async function forgotPassword(email: string): Promise<void> {
  await client.send(new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: email }));
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  await client.send(
    new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    })
  );
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

function tokensFromResult(authResult: { IdToken?: string; AccessToken?: string; RefreshToken?: string } | undefined): AuthTokens {
  if (!authResult?.IdToken || !authResult.AccessToken || !authResult.RefreshToken) {
    throw new Error("Login did not return the expected tokens");
  }
  return { idToken: authResult.IdToken, accessToken: authResult.AccessToken, refreshToken: authResult.RefreshToken };
}

// If the account has TOTP 2FA turned on, InitiateAuth doesn't return tokens
// directly - it returns a challenge that must be answered (the 6-digit
// code) via a second call before Cognito will issue tokens.
export type LoginResult =
  | { status: "success"; tokens: AuthTokens }
  | { status: "mfa_required"; session: string; username: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await client.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  );

  if (result.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
    if (!result.Session) throw new Error("Login did not return the expected MFA session");
    return { status: "mfa_required", session: result.Session, username: email };
  }

  return { status: "success", tokens: tokensFromResult(result.AuthenticationResult) };
}

// A fresh signup can never already have 2FA enabled, so callers right after
// signUp/confirmSignUp can use this instead of handling the MFA branch.
export async function loginExpectingSuccess(email: string, password: string): Promise<AuthTokens> {
  const result = await login(email, password);
  if (result.status !== "success") {
    throw new Error("Unexpected 2FA challenge right after signup");
  }
  return result.tokens;
}

export async function confirmMfaCode(username: string, session: string, code: string): Promise<AuthTokens> {
  const result = await client.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
      Session: session,
      ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: code },
    })
  );
  return tokensFromResult(result.AuthenticationResult);
}

// --- Self-service 2FA enrollment (requires an existing signed-in session's
// AccessToken, not the SigV4-less "unauthenticated action" pattern above) ---

// Returns the shared secret (as a base32 string) used to build the
// authenticator app's otpauth:// QR code - see TwoFactorAuthCard.tsx.
export async function associateSoftwareToken(accessToken: string): Promise<string> {
  const result = await client.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
  if (!result.SecretCode) throw new Error("Couldn't start 2FA setup. Please try again.");
  return result.SecretCode;
}

// Proves the user actually scanned the QR code and their app is in sync
// before we turn 2FA on - without this, a mistyped/unscanned secret would
// lock the user out on their next login.
export async function verifySoftwareToken(accessToken: string, code: string): Promise<void> {
  const result = await client.send(new VerifySoftwareTokenCommand({ AccessToken: accessToken, UserCode: code }));
  if (result.Status !== "SUCCESS") {
    throw new Error("That code didn't match. Please check your authenticator app and try again.");
  }
}

export async function setMfaEnabled(accessToken: string, enabled: boolean): Promise<void> {
  await client.send(
    new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: enabled, PreferredMfa: enabled },
    })
  );
}

export async function getMfaEnabled(accessToken: string): Promise<boolean> {
  const result = await client.send(new GetUserCommand({ AccessToken: accessToken }));
  return (result.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA");
}
