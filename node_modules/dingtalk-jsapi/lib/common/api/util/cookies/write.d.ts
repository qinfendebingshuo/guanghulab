export declare const apiName = "util.cookies.write";
/**
 * 将指定cookie保存到本地cookiestorage 请求参数定义
 * @apiName util.cookies.write
 */
export interface IUtilCookiesWriteParams {
    [key: string]: any;
}
/**
 * 将指定cookie保存到本地cookiestorage 返回结果定义
 * @apiName util.cookies.write
 */
export interface IUtilCookiesWriteResult {
    [key: string]: any;
}
/**
 * 将指定cookie保存到本地cookiestorage
 * @apiName util.cookies.write
 * @supportVersion  ios: 4.0
 */
export declare function write$(params: IUtilCookiesWriteParams): Promise<IUtilCookiesWriteResult>;
export default write$;
