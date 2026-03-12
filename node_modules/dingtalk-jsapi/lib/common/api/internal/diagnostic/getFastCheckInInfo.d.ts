export declare const apiName = "internal.diagnostic.getFastCheckInInfo";
/**
 * 获取最近三天极速打卡排班信息 请求参数定义
 * @apiName internal.diagnostic.getFastCheckInInfo
 */
export interface IInternalDiagnosticGetFastCheckInInfoParams {
}
/**
 * 获取最近三天极速打卡排班信息 返回结果定义
 * @apiName internal.diagnostic.getFastCheckInInfo
 */
export interface IInternalDiagnosticGetFastCheckInInfoResult {
    data: any;
}
/**
 * 获取最近三天极速打卡排班信息
 * @apiName internal.diagnostic.getFastCheckInInfo
 * @supportVersion android: 4.7.19
 * @author Android: 序望
 */
export declare function getFastCheckInInfo$(params: IInternalDiagnosticGetFastCheckInInfoParams): Promise<IInternalDiagnosticGetFastCheckInInfoResult>;
export default getFastCheckInInfo$;
