export declare const apiName = "internal.chat.applyJoinGroup";
/**
 * 在群主需要审核的群，发送请求入群申请 请求参数定义
 * @apiName internal.chat.applyJoinGroup
 */
export interface IInternalChatApplyJoinGroupParams {
    /** 群id  */
    cid: string;
    /** 申请来源 */
    origin: string;
}
/**
 * 在群主需要审核的群，发送请求入群申请 返回结果定义
 * @apiName internal.chat.applyJoinGroup
 */
export interface IInternalChatApplyJoinGroupResult {
    [key: string]: any;
}
/**
 * 在群主需要审核的群，发送请求入群申请
 * @apiName internal.chat.applyJoinGroup
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function applyJoinGroup$(params: IInternalChatApplyJoinGroupParams): Promise<IInternalChatApplyJoinGroupResult>;
export default applyJoinGroup$;
