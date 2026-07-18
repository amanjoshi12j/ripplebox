import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  AuthFlowType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
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

export async function login(email: string, password: string): Promise<AuthTokens> {
  const result = await client.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  );

  const authResult = result.AuthenticationResult;
  if (!authResult?.IdToken || !authResult.AccessToken || !authResult.RefreshToken) {
    throw new Error("Login did not return the expected tokens");
  }

  return {
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken,
  };
}
