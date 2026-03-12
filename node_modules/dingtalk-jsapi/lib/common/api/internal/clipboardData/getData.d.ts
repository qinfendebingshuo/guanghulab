export declare const apiName = "internal.clipboardData.getData";
/**
 * 获取剪切板内容 请求参数定义
 * @apiName internal.clipboardData.getData
 */
export interface IInternalClipboardDataGetDataParams {
    [key: string]: any;
}
/**
 * 获取剪切板内容 返回结果定义
 * @apiName internal.clipboardData.getData
 */
export interface IInternalClipboardDataGetDataResult {
    text: string;
}
/**
 * 获取剪切板内容
 * @apiName internal.clipboardData.getData
 * @supportVersion ios: 4.6.9 android: 4.6.9
 */
export declare function getData$(params: IInternalClipboardDataGetDataParams): Promise<IInternalClipboardDataGetDataResult>;
export default getData$;
