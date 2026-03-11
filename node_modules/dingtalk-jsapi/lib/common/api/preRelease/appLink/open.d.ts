export declare const apiName = "preRelease.appLink.open";
/**
 * 应用跳转 请求参数定义
 * @apiName preRelease.appLink.open
 */
export interface IPreReleaseAppLinkOpenParams {
    [key: string]: any;
}
/**
 * 应用跳转 返回结果定义
 * @apiName preRelease.appLink.open
 */
export interface IPreReleaseAppLinkOpenResult {
    [key: string]: any;
}
/**
 * 应用跳转
 * @apiName preRelease.appLink.open
 * @supportVersion  ios: 2.7.0 android: 2.7.0
 */
export declare function open$(params: IPreReleaseAppLinkOpenParams): Promise<IPreReleaseAppLinkOpenResult>;
export default open$;
