export declare const apiName = "internal.user.getClaimEnergyEntryVisibility";
/**
 * 获取是否在首页显示领取钉能量的入口 请求参数定义
 * @apiName internal.user.getClaimEnergyEntryVisibility
 */
export interface IInternalUserGetClaimEnergyEntryVisibilityParams {
    [key: string]: any;
}
/**
 * 获取是否在首页显示领取钉能量的入口 返回结果定义
 * @apiName internal.user.getClaimEnergyEntryVisibility
 */
export interface IInternalUserGetClaimEnergyEntryVisibilityResult {
    [key: string]: any;
}
/**
 * 获取是否在首页显示领取钉能量的入口
 * @apiName internal.user.getClaimEnergyEntryVisibility
 * @supportVersion ios: 4.3.1 android: 4.3.1
 */
export declare function getClaimEnergyEntryVisibility$(params: IInternalUserGetClaimEnergyEntryVisibilityParams): Promise<IInternalUserGetClaimEnergyEntryVisibilityResult>;
export default getClaimEnergyEntryVisibility$;
