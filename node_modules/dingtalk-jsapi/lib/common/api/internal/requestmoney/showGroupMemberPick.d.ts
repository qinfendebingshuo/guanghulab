export declare const apiName = "internal.requestmoney.showGroupMemberPick";
/**
 * 调起群成员选人组件 请求参数定义
 * @apiName internal.requestmoney.showGroupMemberPick
 */
export interface IInternalRequestmoneyShowGroupMemberPickParams {
    /** 选人组件标题 */
    title?: string;
    /** 人数上限，传0表示不限制 */
    maxUsers?: number;
    /** 不可选的人 */
    disabledUIds?: number[];
    /** 已选的人 */
    pickedUIds?: number[];
    /** 必选的人 */
    requiredUIds?: number[];
    /** 超过人数提示 */
    limitTips?: string;
    /** 指定会话 */
    cId?: string;
}
/**
 * 调起群成员选人组件 返回结果定义
 * @apiName internal.requestmoney.showGroupMemberPick
 */
export interface IInternalRequestmoneyShowGroupMemberPickResult {
    /** 选人的是人  */
    users?: Array<{
        uid: number;
        nick: string;
        avatarURL: string;
    }>;
}
/**
 * 调起群成员选人组件
 * @apiName internal.requestmoney.showGroupMemberPick
 * @supportVersion ios: 4.5.6 android: 4.5.6
 */
export declare function showGroupMemberPick$(params: IInternalRequestmoneyShowGroupMemberPickParams): Promise<IInternalRequestmoneyShowGroupMemberPickResult>;
export default showGroupMemberPick$;
