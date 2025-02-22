export interface Channel {
  expireDate: Date;
  from: string;
  to: string;
  channel: string;
  token: string;
  tokenTo?: string;
}
