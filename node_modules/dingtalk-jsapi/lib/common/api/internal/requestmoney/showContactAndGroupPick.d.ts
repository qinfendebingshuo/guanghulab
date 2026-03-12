export declare const apiName = "internal.requestmoney.showContactAndGroupPick";
/**
 * 调起选人组件 请求参数定义
 * @apiName internal.requestmoney.showContactAndGroupPick
 */
export interface IInternalRequestmoneyShowContactAndGroupPickParams {
    /** 选人组件标题  */
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
    /** 是否显示好友，默认不显示 */
    showFriendPick?: boolean;
    /** 是否显示手机联系人，默认不显示 */
    showMobileContactPick?: boolean;
    /** 是否显示已有的群，默认不显示 */
    showExistingGroupPick?: boolean;
    /** 是否显示常用联系人，默认不显示 */
    showUsualContactPick?: boolean;
}
/**
 * 调起选人组件 返回结果定义
 * @apiName internal.requestmoney.showContactAndGroupPick
 */
export interface IInternalRequestmoneyShowContactAndGroupPickResult {
    /** 会话Id */
    cId?: string;
    /** 群名称 */
    cName?: string;
    /** 群成员人数 */
    memberCount?: number;
    /** 选人的是人  */
    users?: Array<{
        uid?: number;
        nick?: string;
        avatarURL?: string;
    }>;
}
/**
 * 调起选人组件
 * @apiName internal.requestmoney.showContactAndGroupPick
 * @supportVersion ios: 4.5.6 android: 4.5.6
 */
export declare function showContactAndGroupPick$(params: IInternalRequestmoneyShowContactAndGroupPickParams): Promise<IInternalRequestmoneyShowContactAndGroupPickResult>;
export default showContactAndGroupPick$;
