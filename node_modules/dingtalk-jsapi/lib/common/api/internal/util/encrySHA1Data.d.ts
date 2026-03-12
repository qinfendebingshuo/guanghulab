export declare const apiName = "internal.util.encrySHA1Data";
/**
 * 针对入参字符串，加密 请求参数定义
 * @apiName internal.util.encrySHA1Data
 */
export interface IInternalUtilEncrySHA1DataParams {
    /** 要加密的字符串 */
    data: string;
}
/**
 * 针对入参字符串，加密 返回结果定义
 * @apiName internal.util.encrySHA1Data
 */
export interface IInternalUtilEncrySHA1DataResult {
    /** 加密后的字符串 */
    encryStr: string;
}
/**
 * 针对入参字符串，加密
 * @apiName internal.util.encrySHA1Data
 * @supportVersion ios: 4.6.41 android: 4.6.41
 */
export declare function encrySHA1Data$(params: IInternalUtilEncrySHA1DataParams): Promise<IInternalUtilEncrySHA1DataResult>;
export default encrySHA1Data$;
