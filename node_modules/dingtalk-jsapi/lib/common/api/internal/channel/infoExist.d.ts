export declare const apiName = "internal.channel.infoExist";
/**
 * 检查客户端上服务窗是否已开通 请求参数定义
 * @apiName internal.channel.infoExist
 */
export interface IInternalChannelInfoExistParams {
    [key: string]: any;
}
/**
 * 检查客户端上服务窗是否已开通 返回结果定义
 * @apiName internal.channel.infoExist
 */
export interface IInternalChannelInfoExistResult {
    [key: string]: any;
}
/**
 * 检查客户端上服务窗是否已开通
 * @apiName internal.channel.infoExist
 * @supportVersion  ios: 3.2.0 android: 3.2.0
 */
export declare function infoExist$(params: IInternalChannelInfoExistParams): Promise<IInternalChannelInfoExistResult>;
export default infoExist$;
