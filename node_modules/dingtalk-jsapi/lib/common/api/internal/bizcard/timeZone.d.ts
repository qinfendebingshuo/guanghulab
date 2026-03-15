export declare const apiName = "internal.bizcard.timeZone";
/**
 * 获取用户当前时区 请求参数定义
 * @apiName internal.bizcard.timeZone
 */
export interface IInternalBizcardTimeZoneParams {
    [key: string]: any;
}
/**
 * 获取用户当前时区 返回结果定义
 * @apiName internal.bizcard.timeZone
 * String: "GMT-08:00"
 */
export declare type IInternalBizcardTimeZoneResult = string;
/**
 * 获取用户当前时区
 * @apiName internal.bizcard.timeZone
 * @supportVersion ios: 4.5.21 android: 4.5.21
 */
export declare function timeZone$(params: IInternalBizcardTimeZoneParams): Promise<IInternalBizcardTimeZoneResult>;
export default timeZone$;
