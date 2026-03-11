export declare const apiName = "internal.realm.getUserExclusiveInfo";
/**
 * 专属钉钉版本及身份信息获取 请求参数定义
 * @apiName internal.realm.getUserExclusiveInfo
 */
export interface IInternalRealmGetUserExclusiveInfoParams {
}
/**
 * 专属钉钉版本及身份信息获取 返回结果定义
 * @apiName internal.realm.getUserExclusiveInfo
 */
export interface IInternalRealmGetUserExclusiveInfoResult {
    /** 是否专属打包 */
    isExclusiveApp: boolean;
    /** 生效的域组织ID -1: 无域组织生效 */
    mainRealmOrgId: number;
    /** 专属设计生效组织列表 */
    exclusiveOrgList: number[];
}
/**
 * 专属钉钉版本及身份信息获取
 * @apiName internal.realm.getUserExclusiveInfo
 * @supportVersion ios: 5.1.10 android: 5.1.10 pc: 5.1.10
 * @author Android: 晤歌 iOS: 路客 Windows: 秋酷 Mac: 凉糕
 */
export declare function getUserExclusiveInfo$(params: IInternalRealmGetUserExclusiveInfoParams): Promise<IInternalRealmGetUserExclusiveInfoResult>;
export default getUserExclusiveInfo$;
