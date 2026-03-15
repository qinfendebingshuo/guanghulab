export declare const apiName = "biz.navigation.setSubtitle";
/**
 * navigationBar 小标题 请求参数定义
 * @apiName biz.navigation.setSubtitle
 */
export interface IBizNavigationSetSubtitleParams {
    [key: string]: any;
}
/**
 * navigationBar 小标题 返回结果定义
 * @apiName biz.navigation.setSubtitle
 */
export interface IBizNavigationSetSubtitleResult {
    [key: string]: any;
}
/**
 * navigationBar 小标题
 * @apiName biz.navigation.setSubtitle
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function setSubtitle$(params: IBizNavigationSetSubtitleParams): Promise<IBizNavigationSetSubtitleResult>;
export default setSubtitle$;
