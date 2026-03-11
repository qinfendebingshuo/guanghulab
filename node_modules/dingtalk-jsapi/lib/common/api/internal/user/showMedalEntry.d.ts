export declare const apiName = "internal.user.showMedalEntry";
/**
 * 是否显示勋章入口 请求参数定义
 * @apiName internal.user.showMedalEntry
 */
export interface IInternalUserShowMedalEntryParams {
    [key: string]: any;
}
/**
 * 是否显示勋章入口 返回结果定义
 * @apiName internal.user.showMedalEntry
 */
export interface IInternalUserShowMedalEntryResult {
    [key: string]: any;
}
/**
 * 是否显示勋章入口
 * @apiName internal.user.showMedalEntry
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function showMedalEntry$(params: IInternalUserShowMedalEntryParams): Promise<IInternalUserShowMedalEntryResult>;
export default showMedalEntry$;
