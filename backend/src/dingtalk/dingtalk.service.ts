import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

/**
 * 钉钉通知服务 - 支持多组织配置（从数据库读取）
 * 文档: https://open.dingtalk.com/document/development/asynchronous-sending-of-enterprise-session-messages
 */
@Injectable()
export class DingtalkService {
  private readonly logger = new Logger(DingtalkService.name);
  
  // Token缓存（每个组织独立缓存）
  private tokenCache: Map<string, { token: string; expireTime: number }> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * 根据组织从数据库获取配置
   */
  private async getConfig(organization: string) {
    const app = await this.prisma.dingtalkApp.findUnique({
      where: { organization },
    });

    if (!app) {
      throw new Error(`组织 ${organization} 的钉钉应用配置不存在`);
    }

    if (!app.is_active) {
      this.logger.warn(`组织 ${organization} 的钉钉应用已禁用`);
      throw new Error(`组织 ${organization} 的钉钉应用已禁用`);
    }

    return {
      appKey: app.app_key,
      appSecret: app.app_secret,
      corpId: app.corp_id,
      agentId: app.agent_id,
    };
  }

  /**
   * 获取Access Token
   * 文档: https://open.dingtalk.com/document/orgapp/obtain-orgapp-token
   */
  private async getAccessToken(organization: string): Promise<string> {
    try {
      const config = await this.getConfig(organization);
      const cacheKey = organization;

      // 如果token未过期，直接返回
      const now = Date.now();
      const cached = this.tokenCache.get(cacheKey);
      if (cached && cached.expireTime > now) {
        return cached.token;
      }

      // 获取新token
      const response = await axios.get(
        'https://oapi.dingtalk.com/gettoken',
        {
          params: {
            appkey: config.appKey,
            appsecret: config.appSecret,
          },
        }
      );

      if (response.data.errcode === 0) {
        const token = response.data.access_token;
        // token有效期7200秒，提前5分钟过期
        const expireTime = now + (response.data.expires_in - 300) * 1000;
        
        this.tokenCache.set(cacheKey, { token, expireTime });
        this.logger.log(`钉钉Access Token获取成功 [${organization}]`);
        return token;
      } else {
        this.logger.error(`获取钉钉Access Token失败 [${organization}]`, response.data);
        throw new Error(`获取钉钉Access Token失败: ${response.data.errmsg}`);
      }
    } catch (error) {
      this.logger.error(`获取钉钉Access Token异常 [${organization}]`, error);
      throw error;
    }
  }

  /**
   * 根据姓名搜索用户的钉钉userid
   * 文档: https://open.dingtalk.com/document/development/address-book-search-user-id
   * API: POST /v1.0/contact/users/search
   * 
   * @param organization 所属组织
   * @param realName 用户真实姓名
   * @returns 钉钉userid，未找到返回null
   */
  async searchUserIdByName(organization: string, realName: string): Promise<string | null> {
    try {
      const accessToken = await this.getAccessToken(organization);
      
      // 使用新版API搜索用户（v1.0）
      const response = await axios.post(
        'https://api.dingtalk.com/v1.0/contact/users/search',
        {
          queryWord: realName,
          offset: 0,
          size: 20,
          fullMatchField: 1, // 1表示精确匹配
        },
        {
          headers: {
            'x-acs-dingtalk-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      // 新版API响应格式: { list: ["userid1", "userid2"], totalCount: 2, hasMore: false }
      if (response.data && response.data.list && response.data.list.length > 0) {
        // list 是 userid 数组，fullMatchField=1时返回精确匹配的结果
        const userid = response.data.list[0]; // 取第一个匹配结果
        
        this.logger.log(`找到用户 [${organization}] ${realName}: ${userid}`);
        return userid;
      } else {
        this.logger.warn(`未找到匹配的用户 [${organization}] ${realName}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`搜索钉钉用户异常 [${organization}] ${realName}`, error.response?.data || error.message || error);
      return null;
    }
  }

  /**
   * 发送工作通知消息
   * 文档: https://open.dingtalk.com/document/orgapp/asynchronous-sending-of-enterprise-session-messages
   * 
   * @param organization 所属组织
   * @param userIdList 钉钉用户ID列表
   * @param content 消息内容
   */
  async sendWorkNotification(
    organization: string,
    userIdList: string[],
    content: {
      title: string;
      text: string;
    }
  ): Promise<boolean> {
    try {
      // 过滤空的userid
      const validUserIds = userIdList.filter(id => id && id.trim());
      if (validUserIds.length === 0) {
        this.logger.warn(`没有有效的钉钉用户ID，跳过发送通知 [${organization}]`);
        return false;
      }

      const config = await this.getConfig(organization);
      const accessToken = await this.getAccessToken(organization);
      
      // 构造消息体
      const message = {
        agent_id: config.agentId,
        userid_list: validUserIds.join(','),
        msg: {
          msgtype: 'text',
          text: {
            content: `【PBC通知】\n${content.title}\n\n${content.text}`,
          },
        },
      };

      this.logger.log(`准备发送钉钉通知 [${organization}]`, {
        agent_id: config.agentId,
        userIds: validUserIds,
        title: content.title,
      });

      const response = await axios.post(
        `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`,
        message
      );

      if (response.data.errcode === 0) {
        this.logger.log(`钉钉通知发送成功 [${organization}]`, {
          task_id: response.data.task_id,
          userIds: validUserIds,
        });
        return true;
      } else {
        this.logger.error(`钉钉通知发送失败 [${organization}]`, response.data);
        return false;
      }
    } catch (error) {
      this.logger.error(`发送钉钉通知异常 [${organization}]`, error);
      return false;
    }
  }

  /**
   * 发送PBC提交审批通知（给主管）
   */
  async sendSubmitNotification(
    organization: string,
    supervisorDingtalkId: string,
    employeeName: string,
    periodName: string,
    goalCount: number,
  ): Promise<boolean> {
    if (!supervisorDingtalkId) {
      this.logger.warn(`主管未配置钉钉ID，跳过发送通知 [${organization}]`);
      return false;
    }

    return this.sendWorkNotification(
      organization,
      [supervisorDingtalkId],
      {
        title: '待审核提醒',
        text: `${employeeName} 提交了 ${periodName} 的PBC目标（共${goalCount}个），请及时审核。`,
      }
    );
  }

  /**
   * 发送PBC审核通过通知（给员工）
   */
  async sendApproveNotification(
    organization: string,
    employeeDingtalkId: string,
    periodName: string,
    goalCount: number,
  ): Promise<boolean> {
    if (!employeeDingtalkId) {
      this.logger.warn(`员工未配置钉钉ID，跳过发送通知 [${organization}]`);
      return false;
    }

    return this.sendWorkNotification(
      organization,
      [employeeDingtalkId],
      {
        title: '审核通过通知',
        text: `您的 ${periodName} PBC目标（共${goalCount}个）已通过审核。`,
      }
    );
  }

  /**
   * 发送PBC审核驳回通知（给员工）
   */
  async sendRejectNotification(
    organization: string,
    employeeDingtalkId: string,
    periodName: string,
    goalCount: number,
    reason: string,
  ): Promise<boolean> {
    if (!employeeDingtalkId) {
      this.logger.warn(`员工未配置钉钉ID，跳过发送通知 [${organization}]`);
      return false;
    }

    return this.sendWorkNotification(
      organization,
      [employeeDingtalkId],
      {
        title: '审核驳回通知',
        text: `您的 ${periodName} PBC目标（共${goalCount}个）未通过审核。\n驳回原因：${reason}\n请修改后重新提交。`,
      }
    );
  }
}
