export declare const apiName = "internal.chat.createApprovalGroup";
/**
 * 创建审批群 请求参数定义
 * @apiName internal.chat.createApprovalGroup
 */
export interface IInternalChatCreateApprovalGroupParams {
    /** 已选择staff’s */
    selectedEmployeeIds: string[];
    /** 企业Id */
    corpId: string;
    /** 默认群名称 */
    groupName: string;
    /** 审批单id */
    processInstanceId: string;
}
/**
 * 创建审批群 返回结果定义
 * @apiName internal.chat.createApprovalGroup
 */
export interface IInternalChatCreateApprovalGroupResult {
    /** 会话Id */
    cid: string;
}
/**
 * 创建审批群
 * @apiName internal.chat.createApprovalGroup
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function createApprovalGroup$(params: IInternalChatCreateApprovalGroupParams): Promise<IInternalChatCreateApprovalGroupResult>;
export default createApprovalGroup$;
