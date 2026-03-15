export declare const apiName = "internal.util.graySwitch";
/**
 * 读取灰度开关 请求参数定义
 * @apiName internal.util.graySwitch
 */
export interface IInternalUtilGraySwitchParams {
    /** 模块名，默认 general */
    module: string;
    /** 开关key 必填，非空 */
    key: string;
    /** 默认值，默认为false */
    default?: boolean;
}
/**
 * 读取灰度开关 返回结果定义
 * @apiName internal.util.graySwitch
 */
export declare type IInternalUtilGraySwitchResult = boolean;
/**
 * 读取灰度开关
 * @apiName internal.util.graySwitch
 * @supportVersion ios: 4.6.10 android: 4.6.10
 */
export declare function graySwitch$(params: IInternalUtilGraySwitchParams): Promise<IInternalUtilGraySwitchResult>;
export default graySwitch$;
