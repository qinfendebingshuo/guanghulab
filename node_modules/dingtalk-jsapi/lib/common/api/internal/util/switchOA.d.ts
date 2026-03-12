export declare const apiName = "internal.util.switchOA";
/**
 * 通过通知切换首页工作台企业 请求参数定义
 * @apiName internal.util.switchOA
 */
export interface IInternalUtilSwitchOAParams {
    corpId: string;
}
/**
 * 通过通知切换首页工作台企业 返回结果定义
 * @apiName internal.util.switchOA
 */
export interface IInternalUtilSwitchOAResult {
}
/**
 * 通过通知切换首页工作台企业
 * @apiName internal.util.switchOA
 * @supportVersion ios: 4.6.11 android: 4.6.11
 */
export declare function switchOA$(params: IInternalUtilSwitchOAParams): Promise<IInternalUtilSwitchOAResult>;
export default switchOA$;
