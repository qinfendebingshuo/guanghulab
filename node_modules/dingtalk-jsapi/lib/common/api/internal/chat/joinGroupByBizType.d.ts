export declare const apiName = "internal.chat.joinGroupByBizType";
/**
 * 不需要申请直接加入进群 请求参数定义
 * @apiName internal.chat.joinGroupByBizType
 */
export interface IInternalChatJoinGroupByBizTypeParams {
    /** 群id */
    cid: string;
    /** 邀请者uid */
    inviterUid: string;
    /** 业务type */
    bizType: number;
    /** 来源 */
    dest?: string;
    /** 是否开启了群主验证（移动端 only） */
    validationType?: number;
}
/**
 * 不需要申请直接加入进群 返回结果定义
 * @apiName internal.chat.joinGroupByBizType
 */
export interface IInternalChatJoinGroupByBizTypeResult {
}
/**
 * 不需要申请直接加入进群
 * @apiName internal.chat.joinGroupByBizType
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function joinGroupByBizType$(params: IInternalChatJoinGroupByBizTypeParams): Promise<IInternalChatJoinGroupByBizTypeResult>;
export default joinGroupByBizType$;
