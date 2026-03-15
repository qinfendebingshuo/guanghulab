export declare const apiName = "biz.navigation.createEditor";
/**
 * 创建通用组件 请求参数定义
 * @apiName biz.navigation.createEditor
 */
export interface IBizNavigationCreateEditorParams {
    [key: string]: any;
}
/**
 * 创建通用组件 返回结果定义
 * @apiName biz.navigation.createEditor
 */
export interface IBizNavigationCreateEditorResult {
    [key: string]: any;
}
/**
 * 创建通用组件
 * @apiName biz.navigation.createEditor
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function createEditor$(params: IBizNavigationCreateEditorParams): Promise<IBizNavigationCreateEditorResult>;
export default createEditor$;
