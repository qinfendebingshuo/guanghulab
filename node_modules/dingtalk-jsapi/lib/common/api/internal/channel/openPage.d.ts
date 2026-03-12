export declare const apiName = "internal.channel.openPage";
/**
 * 打开指定企业服务窗相关页面 请求参数定义
 * @apiName internal.channel.openPage
 */
export interface IInternalChannelOpenPageParams {
    [key: string]: any;
}
/**
 * 打开指定企业服务窗相关页面 返回结果定义
 * @apiName internal.channel.openPage
 */
export interface IInternalChannelOpenPageResult {
    [key: string]: any;
}
/**
 * 打开指定企业服务窗相关页面
 * @apiName internal.channel.openPage
 * @supportVersion  ios: 3.2.0 android: 3.2.0
 */
export declare function openPage$(params: IInternalChannelOpenPageParams): Promise<IInternalChannelOpenPageResult>;
export default openPage$;
