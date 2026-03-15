export declare const apiName = "biz.navigation.setTitleIcon";
/**
 * 在标题旁边设置一个icon 请求参数定义
 * @apiName biz.navigation.setTitleIcon
 */
export interface IBizNavigationSetTitleIconParams {
    [key: string]: any;
}
/**
 * 在标题旁边设置一个icon 返回结果定义
 * @apiName biz.navigation.setTitleIcon
 */
export interface IBizNavigationSetTitleIconResult {
    [key: string]: any;
}
/**
 * 在标题旁边设置一个icon
 * @apiName biz.navigation.setTitleIcon
 * @supportVersion ios: 4.3.0 android: 4.3.0
 */
export declare function setTitleIcon$(params: IBizNavigationSetTitleIconParams): Promise<IBizNavigationSetTitleIconResult>;
export default setTitleIcon$;
