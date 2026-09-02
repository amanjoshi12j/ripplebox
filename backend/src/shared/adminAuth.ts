import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { HttpError } from "./httpError";

// Admin membership lives in a Cognito Group ("Admins"), never a self-settable
// attribute like custom:role - client/salon_owner are chosen at public
// signup, but nobody should be able to grant themselves admin that way. The
// group is only addable via AWS tooling (see aws_backend_infra notes), never
// through the app itself.
//
// API Gateway's HTTP API JWT authorizer flattens the multi-value
// cognito:groups claim into a Java/AWS-style array-toString string like
// "[Admins]" or "[Admins, OtherGroup]" - not a JSON array (what you'd get
// decoding the raw ID token client-side) and not comma-separated on its own.
// Confirmed by inspecting the actual claims object API Gateway hands the
// Lambda, rather than assuming a shape.
export function requireAdmin(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const adminId = claims?.sub as string | undefined;
  const groupsClaim = claims?.["cognito:groups"] as string | undefined;
  const groups = groupsClaim
    ? groupsClaim.replace(/^\[|\]$/g, "").split(",").map((g) => g.trim())
    : [];

  if (!adminId || !groups.includes("Admins")) {
    throw new HttpError(403, "Admin access required");
  }
  return adminId;
}
