export declare const apiName = "biz.data.getAvatar";
/**
 * 获取头像URL 请求参数定义
 * @apiName biz.data.getAvatar
 */
export interface IBizDataGetAvatarParams {
    [key: string]: any;
}
/**
 * 获取头像URL 返回结果定义
 * @apiName biz.data.getAvatar
 */
export interface IBizDataGetAvatarResult {
    [key: string]: any;
}
/**
 * 获取头像URL
 * @apiName biz.data.getAvatar
 * @supportVersion  ios: 3.3 android: 3.3
 */
export declare function getAvatar$(params: IBizDataGetAvatarParams): Promise<IBizDataGetAvatarResult>;
export default getAvatar$;
