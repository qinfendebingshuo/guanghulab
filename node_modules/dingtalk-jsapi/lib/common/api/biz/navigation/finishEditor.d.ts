export declare const apiName = "biz.navigation.finishEditor";
/**
 * 销毁通用组件 请求参数定义
 * @apiName biz.navigation.finishEditor
 */
export interface IBizNavigationFinishEditorParams {
    [key: string]: any;
}
/**
 * 销毁通用组件 返回结果定义
 * @apiName biz.navigation.finishEditor
 */
export interface IBizNavigationFinishEditorResult {
    [key: string]: any;
}
/**
 * 销毁通用组件
 * @apiName biz.navigation.finishEditor
 * @supportVersion  ios: 2.4.0 android: 2.4.0
 */
export declare function finishEditor$(params: IBizNavigationFinishEditorParams): Promise<IBizNavigationFinishEditorResult>;
export default finishEditor$;
