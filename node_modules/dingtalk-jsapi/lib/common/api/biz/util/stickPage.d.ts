export declare const apiName = "biz.util.stickPage";
/**
 * 将指定链接置顶到钉钉会话首页，点击可快速打开 请求参数定义
 * @apiName biz.util.stickPage
 */
export interface IBizUtilStickPageParams {
    [key: string]: any;
}
/**
 * 将指定链接置顶到钉钉会话首页，点击可快速打开 返回结果定义
 * @apiName biz.util.stickPage
 */
export interface IBizUtilStickPageResult {
    [key: string]: any;
}
/**
 * 将指定链接置顶到钉钉会话首页，点击可快速打开
 * @apiName biz.util.stickPage
 * @supportVersion  ios: 3.4.10 android: 3.4.10
 */
export declare function stickPage$(params: IBizUtilStickPageParams): Promise<IBizUtilStickPageResult>;
export default stickPage$;
