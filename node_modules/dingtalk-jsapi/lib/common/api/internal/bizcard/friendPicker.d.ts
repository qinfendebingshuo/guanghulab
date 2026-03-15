export declare const apiName = "internal.bizcard.friendPicker";
/**
 * 拉起好友选人组件 请求参数定义
 * @apiName internal.bizcard.friendPicker
 */
export interface IInternalBizcardFriendPickerParams {
    /** 标题 */
    title: string;
    /** 超过限定人数返回提示 */
    limitTips: string;
    /** 最大可选人数 */
    maxUsers: number;
    /** 已选用户 */
    pickedUsers: string[];
    /** 不可选用户 */
    disabledUsers: string[];
    /** 必选用户（不可取消选中状态） */
    requiredUsers: string[];
    /** 左下角显示的提示语 */
    pickTips: string;
}
/**
 * 拉起好友选人组件 返回结果定义
 * @apiName internal.bizcard.friendPicker
 */
export declare type IInternalBizcardFriendPickerResult = Array<{
    uid: number;
    name: string;
    mediaId: string;
}>;
/**
 * 拉起好友选人组件
 * @apiName internal.bizcard.friendPicker
 * @supportVersion ios: 4.5.16 android: 4.5.16
 */
export declare function friendPicker$(params: IInternalBizcardFriendPickerParams): Promise<IInternalBizcardFriendPickerResult>;
export default friendPicker$;
