export declare const apiName = "internal.focus.checkEnvironment";
/**
 * 检测投屏环境 请求参数定义
 * @apiName internal.focus.checkEnvironment
 */
export interface IInternalFocusCheckEnvironmentParams {
    [key: string]: any;
}
/**
 * 检测投屏环境 返回结果定义
 * @apiName internal.focus.checkEnvironment
 */
export interface IInternalFocusCheckEnvironmentResult {
    /** 是否支持本地投屏 */
    focusEnable: boolean;
    /** 当前网络类型 */
    networkType: string;
    /** 当前是否联网 */
    networkEnable: boolean;
}
/**
 * 检测投屏环境
 * @apiName internal.focus.checkEnvironment
 * @supportVersion android: 4.7.23
 * @author 安卓：柳樵，战杭， ios：见招
 */
export declare function checkEnvironment$(params: IInternalFocusCheckEnvironmentParams): Promise<IInternalFocusCheckEnvironmentResult>;
export default checkEnvironment$;
