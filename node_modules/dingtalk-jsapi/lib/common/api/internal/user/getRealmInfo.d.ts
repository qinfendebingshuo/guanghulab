export declare const apiName = "internal.user.getRealmInfo";
/**
 * 获取当前登录账号的域相关信息 请求参数定义
 * @apiName internal.user.getRealmInfo
 */
export interface IInternalUserGetRealmInfoParams {
}
/**
 * 获取当前登录账号的域相关信息 返回结果定义
 * @apiName internal.user.getRealmInfo
 */
export interface IInternalUserGetRealmInfoResult {
    /** 返回当前登录用户是否是大客户域账号 */
    isRealm: boolean;
    /** >= 4.7.6; 反应当前登录用户的域打标组织 */
    realmFlagOrgId: string;
    /** >= 4.7.6; 返回当前登录用户域组织列表 */
    realmOrgList: string[];
}
/**
 * 获取当前登录账号的域相关信息
 * @apiName internal.user.getRealmInfo
 * @supportVersion ios: 4.7.1 android: 4.7.1 pc: 4.7.1
 * @author ios:怒龙; android:笔歌; windows:秋酷; mac:凉糕
 */
export declare function getRealmInfo$(params: IInternalUserGetRealmInfoParams): Promise<IInternalUserGetRealmInfoResult>;
export default getRealmInfo$;
