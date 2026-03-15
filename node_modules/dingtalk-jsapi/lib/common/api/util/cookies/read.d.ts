export declare const apiName = "util.cookies.read";
/**
 * 读取本地cookiestorage中在指定域名下的cookie 请求参数定义
 * @apiName util.cookies.read
 */
export interface IUtilCookiesReadParams {
    [key: string]: any;
}
/**
 * 读取本地cookiestorage中在指定域名下的cookie 返回结果定义
 * @apiName util.cookies.read
 */
export interface IUtilCookiesReadResult {
    [key: string]: any;
}
/**
 * 读取本地cookiestorage中在指定域名下的cookie
 * @apiName util.cookies.read
 * @supportVersion  ios: 4.0
 */
export declare function read$(params: IUtilCookiesReadParams): Promise<IUtilCookiesReadResult>;
export default read$;
