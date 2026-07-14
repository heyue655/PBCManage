import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DaslinkService {
  private readonly logger = new Logger('DaslinkService');

  private get host(): string {
    return process.env.DASLINK_HOST || '';
  }

  private get appId(): string {
    return process.env.DASLINK_APP_ID || '';
  }

  private get appSecret(): string {
    return process.env.DASLINK_APP_SECRET || '';
  }

  get enabled(): boolean {
    return process.env.DASLINK_ENABLED === 'true';
  }

  /**
   * Build the DASLink OAuth authorization URL.
   * callbackUrl is the frontend callback page (e.g., http://localhost:3000/transfer)
   */
  getLoginUrl(callbackUrl: string): string {
    const redirectUri = encodeURIComponent(callbackUrl);
    return `${this.host}/thirdAuth?appId=${this.appId}&redirectUri=${redirectUri}`;
  }

  /**
   * Step 1: Exchange authorization code for accessToken.
   * GET {host}/view/v1/api/oauth/nthird/noc/code/accessToken
   */
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    userCode: string;
  }> {
    const url = `${this.host}/view/v1/api/oauth/nthird/noc/code/accessToken`;
    this.logger.log(`Exchanging code at ${url}`);
    const response = await axios.get(url, {
      params: {
        appId: this.appId,
        secret: this.appSecret,
        code,
        grantType: 'authorization_code',
      },
      timeout: 10000,
    });
    const { data } = response;
    this.logger.log(`DASLink exchangeCode response: code=${data.code}, success=${data.success}, msg=${data.msg}`);
    const isSuccess = data.success === true || data.code === '200' || data.code === 200;
    if (!isSuccess || !data.data) {
      this.logger.error(`DASLink code exchange failed: ${data.msg}`);
      throw new Error(`DASLink code exchange failed: ${data.msg}`);
    }
    return data.data;
  }

  /**
   * Step 2: Get user info using accessToken.
   * GET {host}/view/v1/api/oauth/nthird/accessUser
   */
  async getUserInfo(accessToken: string): Promise<{
    code: string;
    dingtalkId: string;
    mobile: string;
    userName: string;
  }> {
    const url = `${this.host}/view/v1/api/oauth/nthird/accessUser`;
    this.logger.log(`Getting user info from ${url}`);
    const response = await axios.get(url, {
      params: { appId: this.appId },
      headers: { token: accessToken },
      timeout: 10000,
    });
    const { data } = response;
    this.logger.log(`DASLink getUserInfo response: code=${data.code}, success=${data.success}, msg=${data.msg}`);
    const isSuccess = data.success === true || data.code === '200' || data.code === 200;
    if (!isSuccess || !data.data) {
      this.logger.error(`DASLink get user info failed: ${data.msg}`);
      throw new Error(`DASLink get user info failed: ${data.msg}`);
    }
    return data.data;
  }
}
