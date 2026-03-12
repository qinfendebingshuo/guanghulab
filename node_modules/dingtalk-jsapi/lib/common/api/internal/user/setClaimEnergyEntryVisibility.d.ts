export declare const apiName = "internal.user.setClaimEnergyEntryVisibility";
/**
 * 设置是否在首页显示领取钉能量的入口 请求参数定义
 * @apiName internal.user.setClaimEnergyEntryVisibility
 */
export interface IInternalUserSetClaimEnergyEntryVisibilityParams {
    [key: string]: any;
}
/**
 * 设置是否在首页显示领取钉能量的入口 返回结果定义
 * @apiName internal.user.setClaimEnergyEntryVisibility
 */
export interface IInternalUserSetClaimEnergyEntryVisibilityResult {
    [key: string]: any;
}
/**
 * 设置是否在首页显示领取钉能量的入口
 * @apiName internal.user.setClaimEnergyEntryVisibility
 * @supportVersion ios: 4.3.1 android: 4.3.1
 */
export declare function setClaimEnergyEntryVisibility$(params: IInternalUserSetClaimEnergyEntryVisibilityParams): Promise<IInternalUserSetClaimEnergyEntryVisibilityResult>;
export default setClaimEnergyEntryVisibility$;
