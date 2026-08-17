/**
 * BMS Session API & Addon Context Type Definitions
 */

export interface BMSSessionInfo {
  bmsUrl: string;
  jwt: string;
  hospitalCode: string;
  hospitalName?: string;
  databaseType?: string;
  userName?: string;
  userRole?: string;
}

export interface AddonContext {
  session: BMSSessionInfo | null;
  sessionId?: string;
  mktToken?: string;
  readOnly: boolean;
  isMock: boolean;
  hn?: string;
  personId?: string;
  houseId?: string;
  villageId?: string;
}

export interface SqlQueryParam {
  value: string | number | boolean;
  value_type: 'string' | 'integer' | 'double' | 'datetime' | 'date' | 'boolean' | 'bytes';
}

export interface SqlQueryParams {
  [paramName: string]: SqlQueryParam;
}

export interface BMSApiResponse<T = any> {
  MessageCode: number;
  Message?: string;
  data?: T[];
  record_count?: number;
  [key: string]: any;
}
