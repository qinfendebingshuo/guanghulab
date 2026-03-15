export declare const apiName = "internal.health.isShowPermissionTip";
/**
 * 判断是否显示开启华为健康权限tip 请求参数定义
 * @apiName internal.health.isShowPermissionTip
 */
export interface IInternalHealthIsShowPermissionTipParams {
}
/**
 * 判断是否显示开启华为健康权限tip 返回结果定义
 * @apiName internal.health.isShowPermissionTip
 */
export interface IInternalHealthIsShowPermissionTipResult {
    isshowtip: boolean;
}
/**
 * 判断是否显示开启华为健康权限tip
 * @apiName internal.health.isShowPermissionTip
 * @supportVersion android: 4.7.27
 * @author android: 南洲
 */
export declare function isShowPermissionTip$(params: IInternalHealthIsShowPermissionTipParams): Promise<IInternalHealthIsShowPermissionTipResult>;
export default isShowPermissionTip$;
