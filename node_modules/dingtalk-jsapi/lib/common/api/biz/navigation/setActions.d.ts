export declare const apiName = "biz.navigation.setActions";
/**
 * 设置右上角 请求参数定义
 * @apiName biz.navigation.setActions
 */
export interface IBizNavigationSetActionsParams {
    /** onSuccess为监听函数 */
    onSuccess?: () => void;
    [key: string]: any;
}
/**
 * 设置右上角 返回结果定义
 * @apiName biz.navigation.setActions
 */
export interface IBizNavigationSetActionsResult {
    [key: string]: any;
}
/**
 * 设置右上角
 * @apiName biz.navigation.setActions
 * @supportVersion  ios: 3.5.2 android: 3.5.2
 */
export declare function setActions$(params: IBizNavigationSetActionsParams): Promise<IBizNavigationSetActionsResult>;
export default setActions$;
