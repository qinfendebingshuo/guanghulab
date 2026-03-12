export declare const apiName = "internal.badges.getTabBadgeByKey";
/**
 * 获取 tabbar 上某个 tab 的红点未读数 请求参数定义
 * @apiName internal.badges.getTabBadgeByKey
 */
export interface IInternalBadgesGetTabBadgeByKeyParams {
    badgeKey: string;
}
/**
 * 获取 tabbar 上某个 tab 的红点未读数 返回结果定义
 * @apiName internal.badges.getTabBadgeByKey
 */
export interface IInternalBadgesGetTabBadgeByKeyResult {
    /** Badge 对象，内容如下 */
    result: any;
}
/**
 * 获取 tabbar 上某个 tab 的红点未读数
 * @apiName internal.badges.getTabBadgeByKey
 * @supportVersion ios: 6.0.2 android: 6.0.2
 * @author iOS: 库珀, Android: 龙雀, 悬铃
 */
export declare function getTabBadgeByKey$(params: IInternalBadgesGetTabBadgeByKeyParams): Promise<IInternalBadgesGetTabBadgeByKeyResult>;
export default getTabBadgeByKey$;
