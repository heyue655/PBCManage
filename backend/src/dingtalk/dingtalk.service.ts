import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * 钉钉通知服务
 * 文档: https://open.dingtalk.com/document/development/asynchronous-sending-of-enterprise-session-messages
 */
@Injectable()
export class DingtalkService {
  private readonly logger = new Logger(DingtalkService.name);
  
  // 钉钉配置
  private readonly appKey = 'dingcf5da3sc90itnjb9';
  private readonly appSecret = 'CI_IG7tpx0XLGFAYnYmh4JM-lnDLts4dLzSl-qlap30FsN73Dc15BRvg7aAL0ypx';
  private readonly corpId = 'ding0434d73b09f8fd4e';
  private readonly agentId = '4219954506';
  
  // Token缓存
  private accessToken: string = '';
  private tokenExpireTime: number = 0;

  /**
   * 获取Access Token
   * 文档: https://open.dingtalk.com/document/orgapp/obtain-orgapp-token
   */
  private async getAccessToken(): Promise<string> {
    try {
      // 如果token未过期，直接返回
      const now = Date.now();
      if (this.accessToken && this.tokenExpireTime > now) {
        return this.accessToken;
      }

      // 获取新token
      const response = await axios.get(
        'https://oapi.dingtalk.com/gettoken',
        {
          params: {
            appkey: this.appKey,
            appsecret: this.appSecret,
          },
        }
      );

      if (response.data.errcode === 0) {
        this.accessToken = response.data.access_token;
        // token有效期7200秒，提前5分钟过期
        this.tokenExpireTime = now + (response.data.expires_in - 300) * 1000;
        this.logger.log('钉钉Access Token获取成功');
        return this.accessToken;
      } else {
        this.logger.error('获取钉钉Access Token失败', response.data);
        throw new Error(`获取钉钉Access Token失败: ${response.data.errmsg}`);
      }
    } catch (error) {
      this.logger.error('获取钉钉Access Token异常', error);
      throw error;
    }
  }

  /**
   * 发送工作通知消息
   * 文档: https://open.dingtalk.com/document/orgapp/asynchronous-sending-of-enterprise-session-messages
   * 
   * @param userIdList 钉钉用户ID列表
   * @param content 消息内容
   */
  async sendWorkNotification(
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
        this.logger.warn('没有有效的钉钉用户ID，跳过发送通知');
        return false;
      }

      const accessToken = await this.getAccessToken();
      
      // 构造消息体
      const message = {
        agent_id: this.agentId,
        userid_list: validUserIds.join(','),
        msg: {
          msgtype: 'text',
          text: {
            content: `【PBC通知】\n${content.title}\n\n${content.text}`,
          },
        },
      };

      this.logger.log('准备发送钉钉通知', {
        agent_id: this.agentId,
        userIds: validUserIds,
        title: content.title,
      });

      const response = await axios.post(
        `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`,
        message
      );

      if (response.data.errcode === 0) {
        this.logger.log('钉钉通知发送成功', {
          task_id: response.data.task_id,
          userIds: validUserIds,
        });
        return true;
      } else {
        this.logger.error('钉钉通知发送失败', response.data);
        return false;
      }
    } catch (error) {
      this.logger.error('发送钉钉通知异常', error);
      return false;
    }
  }

  /**
   * 发送PBC提交审批通知（给主管）
   */
  async sendSubmitNotification(
    supervisorDingtalkId: string,
    employeeName: string,
    periodName: string,
    goalCount: number,
  ): Promise<boolean> {
    if (!supervisorDingtalkId) {
      this.logger.warn('主管未配置钉钉ID，跳过发送通知');
      return false;
    }

    return this.sendWorkNotification(
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
    employeeDingtalkId: string,
    periodName: string,
    goalCount: number,
  ): Promise<boolean> {
    if (!employeeDingtalkId) {
      this.logger.warn('员工未配置钉钉ID，跳过发送通知');
      return false;
    }

    return this.sendWorkNotification(
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
    employeeDingtalkId: string,
    periodName: string,
    goalCount: number,
    reason: string,
  ): Promise<boolean> {
    if (!employeeDingtalkId) {
      this.logger.warn('员工未配置钉钉ID，跳过发送通知');
      return false;
    }

    return this.sendWorkNotification(
      [employeeDingtalkId],
      {
        title: '审核驳回通知',
        text: `您的 ${periodName} PBC目标（共${goalCount}个）未通过审核。\n驳回原因：${reason}\n请修改后重新提交。`,
      }
    );
  }
}
