export declare const apiName = "internal.realm.updateExclusiveConfig";
/**
 * 专属钉钉试用开启/结束后通知native更新界面 请求参数定义
 * @apiName internal.realm.updateExclusiveConfig
 */
export interface IInternalRealmUpdateExclusiveConfigParams {
    /** 发生变更的orgId */
    orgId: string;
    /** 是否回到首页 */
    shouldPopToRoot?: boolean;
}
/**
 * 专属钉钉试用开启/结束后通知native更新界面 返回结果定义
 * @apiName internal.realm.updateExclusiveConfig
 */
export interface IInternalRealmUpdateExclusiveConfigResult {
    [key: string]: any;
}
/**
 * 专属钉钉试用开启/结束后通知native更新界面
 * @apiName internal.realm.updateExclusiveConfig
 * @supportVersion ios: 4.7.31 android: 5.0.0
 * @author android:笔哥, iOS: 路客
 */
export declare function updateExclusiveConfig$(params: IInternalRealmUpdateExclusiveConfigParams): Promise<IInternalRealmUpdateExclusiveConfigResult>;
export default updateExclusiveConfig$;
