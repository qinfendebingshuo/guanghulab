export declare const apiName = "channel.open.profile";
/**
 * 服务窗打开个人profile页面 请求参数定义
 * @apiName channel.open.profile
 */
export interface IChannelOpenProfileParams {
    [key: string]: any;
}
/**
 * 服务窗打开个人profile页面 返回结果定义
 * @apiName channel.open.profile
 */
export interface IChannelOpenProfileResult {
    [key: string]: any;
}
/**
 * 服务窗打开个人profile页面
 * @apiName channel.open.profile
 * @supportVersion  ios: 3.0.0 android: 3.0.0
 */
export declare function profile$(params: IChannelOpenProfileParams): Promise<IChannelOpenProfileResult>;
export default profile$;
