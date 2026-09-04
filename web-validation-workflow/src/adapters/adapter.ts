import type { Credentials } from "../contracts/credentials.js";
import type { Profile } from "../contracts/profile.js";
import type { Authentication, Reason, Service, Stage, ValidationResult } from "../contracts/result.js";

export interface AdapterOutcome { result: ValidationResult; stage: Stage; authentication: Authentication; service: Service; reason: Reason; }
export interface SiteAdapter { validate(credentials: Credentials, profile: Profile): Promise<AdapterOutcome>; }
