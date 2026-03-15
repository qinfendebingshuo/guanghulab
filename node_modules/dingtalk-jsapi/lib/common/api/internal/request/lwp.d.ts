export declare const apiName = "internal.request.lwp";
export declare const mobileParamsDeal: (params: any) => any;
export declare const ERROR_ANDROID_DEAL_ERROR = "\u8B66\u544A\uFF0C\u5B58\u5728 lwp \u63A5\u53E3\u8FD4\u56DE\u57FA\u7840\u6570\u636E\u7C7B\u578B\uFF0C\u5728\u5B89\u5353\u4E0B\u65E0\u6CD5\u6B63\u5E38\u7684\u5904\u7406\uFF0C\u6613\u51FA\u73B0\u5F02\u5E38\u60C5\u51B5\uFF0C\u8BF7\u8BA9\u670D\u52A1\u7AEF\u540C\u5B66\u4FEE\u6539\u6B64 lwp \u63A5\u53E3\uFF0C\u6539\u4E3A\u8FD4\u56DE object\uFF0C\u4E0D\u8FD4\u56DE\u57FA\u7840\u6570\u636E\u7C7B\u578B";
/**
 * lwp通道 请求参数定义
 * @apiName internal.request.lwp
 */
export interface IInternalRequestLwpParams {
    /** lwp接口请求路径 */
    uri: string;
    /** 请求头 */
    headers: {
        [key: string]: any;
    };
    /** 请求数据 */
    body: any[];
}
/**
 * lwp通道 返回结果定义
 * @apiName internal.request.lwp
 */
export interface IInternalRequestLwpResult {
    /** lwp接口返回状态码 */
    code: number;
    /** lwp接口返回业务数据 */
    body: any | {
        code: number | string;
        reason: string;
    };
}
/**
 * lwp通道
 * @apiName internal.request.lwp
 * @supportVersion  pc: 3.0.0 ios: 2.5.1 android: 2.5.1
 */
export declare function lwp$(params: IInternalRequestLwpParams): Promise<IInternalRequestLwpResult>;
export default lwp$;
